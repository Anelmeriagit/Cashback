import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';

export const PEOPLE = ['zhanna', 'denis'];
export const BANKS = ['otp', 'alfa', 'vtb', 'halva', 'sber'];
export const CATS = ['АЗС','Авто и автосервис','Активный отдых','Аптеки','Бытовые услуги','Все покупки','Дом и ремонт','Животные и зоотовары','Здоровье и медицина','Кафе и рестораны','Кино и театры','Книги','Красота','Маркетплейсы','Образование','Одежда и обувь','Путешествия','Развлечения','Связь и интернет','Спорт и фитнес','Супермаркеты','Такси и каршеринг','Техника и электроника','Транспорт','Фастфуд','Цветы','Цифровые товары и подписки'];
export const PCTS = ['0.5','1','1.5','2','3','4','5','6','7','8','10','12','15','20','25','30'];

// Ключ подписи сессий берётся из секрета на сервере (AUTH_HASH) — в коде страницы его нет.
const secret = () => process.env.AUTH_HASH || '';
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const COOKIE = 'cb_session';
const FLAGS = '; HttpOnly; Secure; SameSite=Strict; Path=/';

export function makeCookie(user) {
  const p = Buffer.from(JSON.stringify({ u: user, e: Date.now() + 30 * 864e5 })).toString('base64url');
  return `${COOKIE}=${p}.${sign(p)}${FLAGS}; Max-Age=2592000`;
}
export const clearCookie = `${COOKIE}=${FLAGS}; Max-Age=0`;

export function session(req) {
  if (!secret()) return null;
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.e > Date.now() && d.u === process.env.AUTH_USER ? d.u : null;
  } catch { return null; }
}

export function checkLogin(user, pass) {
  const [salt, hash] = (process.env.AUTH_HASH || ':').split(':');
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(String(pass || ''), Buffer.from(salt, 'hex'), 64);
  const okPass = crypto.timingSafeEqual(calc, Buffer.from(hash, 'hex'));
  const okUser = String(user || '').trim().toLowerCase() === String(process.env.AUTH_USER || '').toLowerCase();
  return okPass && okUser;
}

// Серверная проверка: в хранилище попадают только допустимые значения.
export function cleanCustom(list) {
  const out = [];
  const seen = new Set(CATS.map((c) => c.toLowerCase()));
  for (const v of Array.isArray(list) ? list : []) {
    if (typeof v !== 'string') continue;
    const t = v.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 40 || /[<>"'`&\\\u0000-\u001f]/.test(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}

export function clean(d) {
  const out = {};
  out.custom = cleanCustom(d && d.custom);
  const allowed = new Set([...CATS, ...out.custom]);
  for (const p of PEOPLE) {
    const seen = new Set();
    const list = Array.isArray(d && d[p]) ? d[p] : [];
    out[p] = list
      .filter((b) => b && BANKS.includes(b.bank) && !seen.has(b.bank) && seen.add(b.bank))
      .map((b) => ({
        bank: b.bank,
        items: (Array.isArray(b.items) ? b.items : [])
          .filter((i) => i && allowed.has(i.cat) && PCTS.includes(i.pct))
          .slice(0, 60)
          .map((i) => ({ cat: i.cat, pct: i.pct })),
      }));
  }
  return out;
}

const path = (user) => `data/${crypto.createHash('sha256').update(user).digest('hex').slice(0, 32)}.json`;

export async function loadData(user) {
  try {
    const r = await get(path(user), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return clean({});
    return clean(JSON.parse(await new Response(r.stream).text()));
  } catch (e) {
    if (/not\s*found|404/i.test(String(e && (e.message || e.name)))) return clean({});
    throw e;
  }
}

export async function saveData(user, data) {
  await put(path(user), JSON.stringify(data), {
    access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
  });
}
