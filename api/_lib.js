import crypto from 'node:crypto';
import * as B from '@vercel/blob';
const { get, put, head } = B;

export const PEOPLE = ['zhanna', 'denis'];
export const BANKS = ['otp', 'alfa', 'vtb', 'halva', 'sber'];
export const CATS = ['АЗС','Авто и автосервис','Активный отдых','Аптеки','Бытовые услуги','Все покупки','Дом и ремонт','Животные и зоотовары','Здоровье и медицина','Кафе и рестораны','Кино и театры','Книги','Красота','Маркетплейсы','Образование','Одежда и обувь','Путешествия','Развлечения','Связь и интернет','Спорт и фитнес','Супермаркеты','Такси и каршеринг','Техника и электроника','Транспорт','Фастфуд','Цветы','Цифровые товары и подписки'];
export const PCTS = ['0.5','1','1.5','2','3','4','5','6','7','8','10','12','15','20','25','30'];

// Ключ подписи сессий берётся из секрета на сервере (AUTH_HASH) — в коде страницы его нет.
// Отдельный ключ подписи сессий. Пока SESSION_SECRET не задан, используется AUTH_HASH (с предупреждением).
const secret = () => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  console.warn('SESSION_SECRET не задан: сессии подписаны AUTH_HASH. Задайте SESSION_SECRET.');
  return process.env.AUTH_HASH || '';
};
// Смена SESSION_VERSION в настройках Vercel мгновенно разлогинивает все устройства.
const ver = () => String(process.env.SESSION_VERSION || '1');
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const COOKIE = 'cb_session';
const FLAGS = '; HttpOnly; Secure; SameSite=Strict; Path=/';

export function makeCookie(user) {
  const p = Buffer.from(JSON.stringify({ u: user, e: Date.now() + 30 * 864e5, i: Date.now(), v: ver() })).toString('base64url');
  return `${COOKIE}=${p}.${sign(p)}${FLAGS}; Max-Age=2592000`;
}
export const clearCookie = `${COOKIE}=${FLAGS}; Max-Age=0`;

function parseSession(req) {
  if (!secret()) return null;
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.e > Date.now() && d.u === process.env.AUTH_USER && String(d.v === undefined ? '1' : d.v) === ver() ? d : null;
  } catch { return null; }
}
export function session(req) { const d = parseSession(req); return d ? d.u : null; }
// Если сессии больше 7 дней, выдаём новую cookie на 30 дней (скользящий срок).
export function renewCookie(req) {
  const d = parseSession(req);
  return d && Date.now() - (d.i || 0) > 7 * 864e5 ? makeCookie(d.u) : null;
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

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const PART_RE = /^(\d{4}-(0[1-9]|1[0-2]):(zhanna|denis)|custom)$/;

export function curMonth() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return p.find((x) => x.type === 'year').value + '-' + p.find((x) => x.type === 'month').value;
}
export function shiftMonth(k, n) {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function cleanBlocks(list, allowed) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((b) => b && BANKS.includes(b.bank) && !seen.has(b.bank) && seen.add(b.bank))
    .map((b) => ({
      bank: b.bank,
      items: (Array.isArray(b.items) ? b.items : [])
        .filter((i) => i && allowed.has(i.cat) && PCTS.includes(i.pct))
        .slice(0, 60)
        .map((i) => ({ cat: i.cat, pct: i.pct })),
    }));
}

// Документ: { months: { 'YYYY-MM': { zhanna: [...], denis: [...] } }, custom: [...] }
export function clean(d) {
  const custom = cleanCustom(d && d.custom);
  const allowed = new Set([...CATS, ...custom]);
  const src = d && d.months && typeof d.months === 'object' ? d.months : {};
  const months = {};
  for (const k of Object.keys(src).filter((k) => MONTH_RE.test(k)).sort().slice(-60)) {
    const m = src[k] || {};
    const v = { zhanna: cleanBlocks(m.zhanna, allowed), denis: cleanBlocks(m.denis, allowed) };
    if (v.zhanna.length || v.denis.length) months[k] = v;
  }
  return { months, custom };
}

const path = (user) => `data/${crypto.createHash('sha256').update(user).digest('hex').slice(0, 32)}.json`;

export const cleanRev = (r) => {
  const out = {};
  for (const [k, v] of Object.entries(r && typeof r === 'object' ? r : {})) {
    if (PART_RE.test(k) && Number.isInteger(v) && v >= 0) out[k] = v;
  }
  return out;
};
export const isPrecond = (e) => /precondition|already\s*exists/i.test(String(e && (e.name + ' ' + e.message)));
const isMissing = (e) => /not\s*found|404/i.test(String(e && (e.message || e.name)));
const fresh = () => ({ ...clean({}), rev: {} });

// Читает документ с ETag. Старый формат (zhanna/denis без месяцев) переносится в текущий месяц.
export async function readDoc(user) {
  try {
    const r = await get(path(user), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return { doc: fresh(), etag: null, legacy: false };
    const raw = JSON.parse(await new Response(r.stream).text());
    let etag = r.blob && r.blob.etag;
    if (!etag) etag = (await head(path(user))).etag;
    if (raw && raw.months === undefined && (raw.zhanna || raw.denis)) {
      const m = curMonth();
      const old = raw.rev && typeof raw.rev === 'object' ? raw.rev : {};
      const rev = {};
      for (const p of PEOPLE) if (Number.isInteger(old[p])) rev[`${m}:${p}`] = old[p];
      if (Number.isInteger(old.custom)) rev.custom = old.custom;
      const src = { custom: raw.custom, months: { [m]: { zhanna: raw.zhanna, denis: raw.denis } } };
      return { doc: { ...clean(src), rev: cleanRev(rev) }, etag, legacy: true };
    }
    return { doc: { ...clean(raw), rev: cleanRev(raw && raw.rev) }, etag, legacy: false };
  } catch (e) {
    if (isMissing(e)) return { doc: fresh(), etag: null, legacy: false };
    throw e;
  }
}

// Запись только если файл не менялся с момента чтения (ifMatch). force — запасной вариант.
export async function writeDoc(user, doc, etag, force) {
  const body = JSON.stringify(doc);
  const base = { access: 'private', addRandomSuffix: false, contentType: 'application/json' };
  if (force) return put(path(user), body, { ...base, allowOverwrite: true });
  if (etag) return put(path(user), body, { ...base, allowOverwrite: true, ifMatch: etag });
  return put(path(user), body, { ...base, allowOverwrite: false });
}

// Читает документ; если он в старом формате, один раз сохраняет его в новом.
export async function loadDoc(user) {
  let r = await readDoc(user);
  if (r.legacy) {
    try { await writeDoc(user, r.doc, r.etag); } catch (e) { if (!isPrecond(e)) throw e; }
    const r2 = await readDoc(user);
    if (!r2.legacy) r = r2;
  }
  return r;
}

/* ---------- ограничение попыток входа (хранится в Blob, переживает перезапуски инстансов) ---------- */
const WIN = 15 * 60 * 1000, IP_MAX = 5, ALL_MAX = 50;
const fpath = (s) => 'auth/' + crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32) + '.json';
async function readJson(p) {
  try {
    const r = await get(p, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) { if (isMissing(e)) return null; throw e; }
}
const writeJson = (p, v) => put(p, JSON.stringify(v), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
const live = (r) => (r && Date.now() - r.t < WIN ? r : { n: 0, t: Date.now() });
const mins = (r) => Math.max(1, Math.ceil((WIN - (Date.now() - r.t)) / 60000));

export async function loginState(ip) {
  try {
    const [a, g] = await Promise.all([readJson(fpath('ip:' + ip)), readJson(fpath('all'))]);
    const ipr = live(a), all = live(g);
    if (ipr.n >= IP_MAX) return { ip, ipr, all, blocked: true, minutes: mins(ipr) };
    if (all.n >= ALL_MAX) return { ip, ipr, all, blocked: true, minutes: mins(all) };
    return { ip, ipr, all, blocked: false };
  } catch (e) {
    console.error('login limiter unavailable', e.message);
    return { ip, ipr: { n: 0, t: Date.now() }, all: { n: 0, t: Date.now() }, blocked: false, broken: true };
  }
}
export async function loginFailed(s) {
  if (s.broken) return;
  try { s.ipr.n++; s.all.n++; await Promise.all([writeJson(fpath('ip:' + s.ip), s.ipr), writeJson(fpath('all'), s.all)]); }
  catch (e) { console.error('login limiter write', e.message); }
}
export async function loginOk(s) {
  if (s.broken || !s.ipr.n) return;
  try { await writeJson(fpath('ip:' + s.ip), { n: 0, t: Date.now() }); } catch (e) { console.error(e.message); }
}
