import crypto from 'node:crypto';
import * as B from '@vercel/blob';
import { loadDoc, isPrecond, shiftMonth } from './_lib.js';
const { get, put, head } = B;

/* ---------- люди (бот отвечает только им) ---------- */
export const PERSONS = {
  denis: { name: 'Денис', username: 'anelmeria' },
  zhanna: { name: 'Жанна', username: 'zhannaradeeva' },
};
export function personOf(from) {
  const u = String((from && from.username) || '').toLowerCase();
  return Object.keys(PERSONS).find((k) => PERSONS[k].username === u) || null;
}

/* ---------- время: Москва ---------- */
export function mskNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t) => parts.find((x) => x.type === t).value;
  const month = g('year') + '-' + g('month');
  return { month, date: month + '-' + g('day') };
}

/* ---------- напоминания ---------- */
// Цикл = календарный месяц ('YYYY-MM'). Состояние каждого цикла хранится отдельно,
// поэтому в новом месяце всё начинается заново.
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (cm) => { const [y, m] = cm.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const days = (cm, list) => list.map((d) => cm + '-' + pad(d));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const eachDay = (a, b) => { const out = []; for (let t = a; t <= b; t += 864e5) out.push(iso(t)); return out; };
// Все дни месяца
const wholeMonth = (cm) => { const [y, m] = cm.split('-').map(Number); return eachDay(Date.UTC(y, m - 1, 1), Date.UTC(y, m - 1, daysIn(cm))); };
// С 23 числа месяца до 22 числа следующего (включительно)
const from23 = (cm) => { const [y, m] = cm.split('-').map(Number); return eachDay(Date.UTC(y, m - 1, 23), Date.UTC(y, m, 22)); };
const okBtn = (id, label) => (cm) => [[{ text: label, callback_data: `ok|${id}|${cm}` }]];

export const TEST_CYCLE = '2000-01'; // тестовый цикл для ручной проверки (/api/cron?send=...)

export const REMINDERS = {
  cashback: {
    who: ['denis', 'zhanna'],
    text: 'Привет! Не забудь выбрать кешбэк на новый период.',
    slot: 'evening', // 18:00–19:00 МСК
    // 25 и 28 числа + последний раз на следующий день (29-го; если 29-го нет — 1-го числа следующего месяца)
    dates: (cm) => days(cm, [25, 28]).concat(daysIn(cm) >= 29 ? [cm + '-29'] : [shiftMonth(cm, 1) + '-01']),
    buttons: okBtn('cashback', 'Готово'),
    doneText: 'Проверка пройдена ✅ Категории на сайте заполнены.',
  },
  meters: {
    who: ['denis', 'zhanna'],
    text: 'Привет! Отправь счётчики.',
    slot: 'evening', // 18:00–19:00 МСК
    firstCycle: '2026-10', // первый цикл начинается 23.10.2026; прошлые месяцы не напоминаем
    // с 23 числа каждый день, пока человек не нажмёт «Готово»; цикл заканчивается 22-го следующего месяца
    dates: from23,
    buttons: okBtn('meters', 'Готово'),
    doneLabel: 'Готово',
  },
  halva: {
    who: ['denis', 'zhanna'],
    text: 'Привет! Надо потратить Халву.',
    slot: 'day', // 14:00–15:00 МСК
    dates: (cm) => days(cm, [7, 12, 17, 22, 27]),
    buttons: (cm) => [[
      { text: 'Напомнить позже', callback_data: `later|halva|${cm}` },
      { text: 'Всё потрачено', callback_data: `ok|halva|${cm}` },
    ]],
    doneLabel: 'Всё потрачено',
  },
  mortgage: {
    who: ['denis'],
    text: 'Привет! Надо закинуть ипотеку.',
    slot: 'day', // 14:00–15:00 МСК
    dates: (cm) => days(cm, [22]),
    buttons: okBtn('mortgage', 'Готово'),
    doneLabel: 'Готово',
  },
  daily: {
    who: ['zhanna'],
    text: 'Бить Денису жопу',
    slot: 'day', // 14:00–15:00 МСК
    dates: wholeMonth, // каждый день, без кнопок и без «выполнено»
  },
};

/* ---------- состояние (Vercel Blob) ---------- */
// { users: { denis: {chat, username}, ... },
//   settings: { cashback: { on, denis, zhanna }, ... },
//   cycles: { 'halva:2026-10': { done: { denis: true }, sent: { '2026-10-05': ['denis'] } } } }
const PATH = 'bot/state.json';
const fresh = () => ({ users: {}, settings: {}, cycles: {} });
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const norm = (raw) => ({ users: obj(raw && raw.users), settings: obj(raw && raw.settings), cycles: obj(raw && raw.cycles) });
const isMissing = (e) => /not\s*found|404/i.test(String(e && (e.message || e.name)));

export async function readState() {
  try {
    const r = await get(PATH, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return { state: fresh(), etag: null };
    const raw = JSON.parse(await new Response(r.stream).text());
    let etag = r.blob && r.blob.etag;
    if (!etag) etag = (await head(PATH)).etag;
    return { state: norm(raw), etag };
  } catch (e) {
    if (isMissing(e)) return { state: fresh(), etag: null };
    throw e;
  }
}

async function writeState(state, etag, force) {
  const body = JSON.stringify(state);
  const base = { access: 'private', addRandomSuffix: false, contentType: 'application/json' };
  if (force) return put(PATH, body, { ...base, allowOverwrite: true });
  if (etag) return put(PATH, body, { ...base, allowOverwrite: true, ifMatch: etag });
  return put(PATH, body, { ...base, allowOverwrite: false });
}

// Читает состояние, применяет fn(state) (она меняет объект и может вернуть результат), записывает.
// При гонке (чужая запись) повторяет с свежим состоянием.
export async function mutate(fn) {
  let prevSig = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { state, etag } = await readState();
    const before = JSON.stringify(state);
    const result = fn(state);
    if (JSON.stringify(state) === before) return result;
    // ETag не совпал, а содержимое с прошлой попытки то же -> чужой записи не было, пишем без ifMatch.
    const force = prevSig !== null && before === prevSig;
    try {
      await writeState(state, etag, force);
      return result;
    } catch (e) {
      if (!isPrecond(e)) throw e;
      prevSig = before;
    }
  }
  throw new Error('state busy');
}

/* ---------- настройки и расписание ---------- */
export function enabled(state, id, p) {
  const s = obj(state.settings[id]);
  return s.on !== false && s[p] !== false;
}

export function publicSettings(state) {
  const out = {};
  for (const [id, R] of Object.entries(REMINDERS)) {
    const s = obj(state.settings[id]);
    out[id] = { on: s.on !== false };
    for (const p of R.who) out[id][p] = s[p] !== false;
  }
  return out;
}

export const linkedOf = (state) => ({ denis: !!(state.users.denis && state.users.denis.chat), zhanna: !!(state.users.zhanna && state.users.zhanna.chat) });

// Что отправить сегодня. Меняет state: помечает отправки заранее, чтобы повторный запуск cron не дублировал.
export function planDue(state, now, slot) {
  const out = [];
  for (const [id, R] of Object.entries(REMINDERS)) {
    if (slot && (R.slot || 'day') !== slot) continue;
    // текущий и прошлый месяц: последнее напоминание «кешбэка» в коротком феврале выпадает на 1 марта
    for (const cm of [now.month, shiftMonth(now.month, -1)]) {
      if (R.firstCycle && cm < R.firstCycle) continue;
      if (!R.dates(cm).includes(now.date)) continue;
      const key = id + ':' + cm;
      const c = state.cycles[key] || { done: {}, sent: {} };
      for (const p of R.who) {
        if (!enabled(state, id, p) || c.done[p]) continue;
        const chat = state.users[p] && state.users[p].chat;
        if (!chat) continue;
        const sent = c.sent[now.date] || (c.sent[now.date] = []);
        if (sent.includes(p)) continue;
        sent.push(p);
        state.cycles[key] = c;
        out.push({ id, p, cycle: cm, chat });
      }
    }
  }
  const lo = shiftMonth(now.month, -4);
  for (const k of Object.keys(state.cycles)) if (String(k.split(':')[1]) < lo) delete state.cycles[k];
  return out;
}

export function markDone(id, cm, p) {
  return mutate((st) => {
    const k = id + ':' + cm;
    const c = st.cycles[k] || (st.cycles[k] = { done: {}, sent: {} });
    c.done[p] = true;
  });
}

/* ---------- проверка заполнения на сайте ---------- */
export const targetMonth = (cm) => (cm === TEST_CYCLE ? shiftMonth(mskNow().month, 1) : shiftMonth(cm, 1));

export async function isFilled(person, month) {
  const { doc } = await loadDoc(process.env.AUTH_USER);
  const list = (doc.months[month] && doc.months[month][person]) || [];
  return list.some((b) => (b.items || []).some((i) => i.cat && i.pct));
}

/* ---------- Telegram ---------- */
const token = () => process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
export const webhookSecret = () => crypto.createHash('sha256').update('wh:' + token()).digest('hex');

export async function tg(method, payload) {
  if (!token()) throw new Error('Не задан TELEGRAM_BOT_TOKEN');
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || 'telegram ' + r.status);
  return j.result;
}

export function sendReminder(chat, id, cycle) {
  const R = REMINDERS[id];
  const body = { chat_id: chat, text: R.text };
  if (R.buttons) body.reply_markup = { inline_keyboard: R.buttons(cycle) };
  return tg('sendMessage', body);
}

export function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Доступ к служебным адресам (/api/cron, /api/tg-setup): тот же CRON_SECRET, который Vercel шлёт в cron.
export function authed(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = String(req.headers.authorization || '');
  const key = h.startsWith('Bearer ') ? h.slice(7) : String((req.query && req.query.key) || '');
  return safeEq(key, secret);
}
