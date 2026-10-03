// Серверные проверки: api/_lib.js (сессии, вход, лимитер, документ кешбэков) и api/login.js.
// Запуск: node --import ./tests/loader/register.mjs --test tests/server/
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { __reset, put } from '../stubs/blob.mjs';
import { mockReq, mockRes, setEnv, makeAuthHash, fakeClock, TEST_USER, TEST_PASS } from '../helpers.mjs';

setEnv();
const lib = await import('../../api/_lib.js');
const login = (await import('../../api/login.js')).default;

beforeEach(() => { __reset(); setEnv(); });

const cookieOf = (setCookie) => setCookie.split(';')[0];
const reqWith = (setCookie) => ({ headers: { cookie: cookieOf(setCookie) } });
const DAY = 864e5;

/* ---------- вход ---------- */
test('checkLogin: верные данные проходят, регистр и пробелы в имени не важны', () => {
  assert.equal(lib.checkLogin(TEST_USER, TEST_PASS), true);
  assert.equal(lib.checkLogin('  test ', TEST_PASS), true);
});

test('checkLogin: неверный пароль, имя или пустой AUTH_HASH отклоняются', () => {
  assert.equal(lib.checkLogin(TEST_USER, 'other'), false);
  assert.equal(lib.checkLogin('someone', TEST_PASS), false);
  assert.equal(lib.checkLogin(TEST_USER, undefined), false);
  const saved = process.env.AUTH_HASH;
  delete process.env.AUTH_HASH;
  assert.equal(lib.checkLogin(TEST_USER, TEST_PASS), false);
  process.env.AUTH_HASH = saved;
});

/* ---------- сессия ---------- */
test('cookie: флаги и круг «выдали → прочитали»', () => {
  const c = lib.makeCookie(TEST_USER);
  assert.match(c, /^cb_session=[^;]+\.[^;]+;/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000']) assert.ok(c.includes(flag), flag);
  assert.equal(lib.session(reqWith(c)), TEST_USER);
});

test('cookie: подделанная подпись или содержимое не принимаются', () => {
  const [name, rest] = cookieOf(lib.makeCookie(TEST_USER)).split('=');
  const [p, s] = rest.split('.');
  const flip = (str) => str.slice(0, -1) + (str.endsWith('A') ? 'B' : 'A');
  assert.equal(lib.session({ headers: { cookie: `${name}=${p}.${flip(s)}` } }), null);
  assert.equal(lib.session({ headers: { cookie: `${name}=${flip(p)}.${s}` } }), null);
  assert.equal(lib.session({ headers: { cookie: `${name}=garbage` } }), null);
  assert.equal(lib.session({ headers: {} }), null);
});

test('cookie: истекает через 30 дней', (t) => {
  const c = lib.makeCookie(TEST_USER);
  const clock = fakeClock(t);
  clock.advance(29 * DAY);
  assert.equal(lib.session(reqWith(c)), TEST_USER);
  clock.advance(2 * DAY);
  assert.equal(lib.session(reqWith(c)), null);
});

test('SESSION_VERSION и AUTH_USER: смена разлогинивает', () => {
  const c = lib.makeCookie(TEST_USER);
  process.env.SESSION_VERSION = '2';
  assert.equal(lib.session(reqWith(c)), null);
  process.env.SESSION_VERSION = '1';
  assert.equal(lib.session(reqWith(c)), TEST_USER);
  process.env.AUTH_USER = 'Other';
  assert.equal(lib.session(reqWith(c)), null);
});

test('смена SESSION_SECRET делает старые cookie недействительными', () => {
  const c = lib.makeCookie(TEST_USER);
  process.env.SESSION_SECRET = 'another-secret-0123456789abcdef';
  assert.equal(lib.session(reqWith(c)), null);
});

test('renewCookie: свежую не трогает, старше 7 дней продлевает', (t) => {
  const c = lib.makeCookie(TEST_USER);
  assert.equal(lib.renewCookie(reqWith(c)), null);
  fakeClock(t).advance(8 * DAY);
  const renewed = lib.renewCookie(reqWith(c));
  assert.ok(renewed && renewed.startsWith('cb_session='));
  assert.equal(lib.session(reqWith(renewed)), TEST_USER);
});

/* ---------- лимитер попыток ---------- */
test('лимитер: 5 неудач с одного адреса блокируют его, другой адрес свободен', async () => {
  for (let i = 0; i < 5; i++) {
    const s = await lib.loginState('1.1.1.1');
    assert.equal(s.blocked, false, 'попытка ' + (i + 1));
    await lib.loginFailed(s);
  }
  const blocked = await lib.loginState('1.1.1.1');
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.minutes >= 1 && blocked.minutes <= 15);
  assert.equal((await lib.loginState('2.2.2.2')).blocked, false);
});

test('лимитер: успешный вход сбрасывает счётчик адреса', async () => {
  for (let i = 0; i < 4; i++) await lib.loginFailed(await lib.loginState('3.3.3.3'));
  await lib.loginOk(await lib.loginState('3.3.3.3'));
  const s = await lib.loginState('3.3.3.3');
  assert.equal(s.blocked, false);
  assert.equal(s.ipr.n, 0);
});

test('лимитер: 50 неудач с разных адресов блокируют всех', async () => {
  for (let i = 0; i < 50; i++) await lib.loginFailed(await lib.loginState('10.0.0.' + i));
  const s = await lib.loginState('99.99.99.99');
  assert.equal(s.blocked, true);
});

test('лимитер: окно 15 минут истекает', async (t) => {
  for (let i = 0; i < 5; i++) await lib.loginFailed(await lib.loginState('4.4.4.4'));
  assert.equal((await lib.loginState('4.4.4.4')).blocked, true);
  fakeClock(t).advance(16 * 60 * 1000);
  assert.equal((await lib.loginState('4.4.4.4')).blocked, false);
});

/* ---------- обработчик /api/login ---------- */
test('login: GET даёт 405 и Cache-Control: no-store', async () => {
  const res = mockRes();
  await login(mockReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('login: верные данные дают 200 и cookie, тело может быть строкой JSON', async () => {
  const res = mockRes();
  await login(mockReq({ method: 'POST', headers: { 'x-vercel-forwarded-for': '5.5.5.5' }, body: JSON.stringify({ user: TEST_USER, pass: TEST_PASS }) }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(lib.session(reqWith(res.headers['set-cookie'])), TEST_USER);
});

test('login: неверный пароль даёт 401 без cookie (с задержкой ~700 мс)', async () => {
  const res = mockRes();
  const t0 = Date.now();
  await login(mockReq({ method: 'POST', headers: { 'x-vercel-forwarded-for': '6.6.6.6' }, body: { user: TEST_USER, pass: 'bad' } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['set-cookie'], undefined);
  assert.ok(Date.now() - t0 >= 650, 'задержка после ошибки');
});

test('login: после 5 неудач адрес получает 429, даже с верным паролем', async () => {
  for (let i = 0; i < 5; i++) await lib.loginFailed(await lib.loginState('7.7.7.7'));
  const res = mockRes();
  await login(mockReq({ method: 'POST', headers: { 'x-vercel-forwarded-for': '7.7.7.7' }, body: { user: TEST_USER, pass: TEST_PASS } }), res);
  assert.equal(res.statusCode, 429);
  assert.match(res.body.error, /Слишком много попыток/);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('login: пустое и битое тело не роняют обработчик', async () => {
  for (const body of [undefined, '{oops', 'null', 42]) {
    const res = mockRes();
    await login(mockReq({ method: 'POST', headers: { 'x-vercel-forwarded-for': '8.8.8.8' + String(body).length }, body }), res);
    assert.equal(res.statusCode, 401, String(body));
  }
});

/* ---------- документ кешбэков ---------- */
test('clean: отбрасывает чужие банки, категории, проценты и опасные строки', () => {
  const doc = lib.clean({
    custom: ['Моя', 'моя', 'АЗС', '<b>x</b>', 'a"b', '  ', 'x'.repeat(41), 5],
    months: {
      '2026-10': {
        zhanna: [
          { bank: 'otp', items: [{ cat: 'АЗС', pct: '5' }, { cat: 'АЗС', pct: '9' }, { cat: 'Нет такой', pct: '5' }, { cat: 'Моя', pct: '1.5' }] },
          { bank: 'otp', items: [{ cat: 'АЗС', pct: '5' }] },
          { bank: 'xx', items: [] },
        ],
        denis: [],
      },
      'bad-key': { zhanna: [{ bank: 'otp', items: [] }] },
      '2026-11': { zhanna: [], denis: [] },
    },
  });
  assert.deepEqual(doc.custom, ['Моя']);
  assert.deepEqual(Object.keys(doc.months), ['2026-10']);
  assert.deepEqual(doc.months['2026-10'].zhanna, [{ bank: 'otp', items: [{ cat: 'АЗС', pct: '5' }, { cat: 'Моя', pct: '1.5' }] }]);
});

test('writeDoc/readDoc: ETag защищает от затирания', async () => {
  const r0 = await lib.readDoc(TEST_USER);
  assert.equal(r0.etag, null);
  await lib.writeDoc(TEST_USER, r0.doc, null);
  await assert.rejects(lib.writeDoc(TEST_USER, r0.doc, null), (e) => lib.isPrecond(e), 'повторное создание');
  const r1 = await lib.readDoc(TEST_USER);
  assert.ok(r1.etag);
  await lib.writeDoc(TEST_USER, r1.doc, r1.etag);
  await assert.rejects(lib.writeDoc(TEST_USER, r1.doc, r1.etag), (e) => lib.isPrecond(e), 'устаревший ETag');
  await lib.writeDoc(TEST_USER, r1.doc, null, true);
});

test('loadDoc: старый формат переносится в текущий месяц и сохраняется один раз', async () => {
  const path = 'data/' + crypto.createHash('sha256').update(TEST_USER).digest('hex').slice(0, 32) + '.json';
  const legacy = { zhanna: [{ bank: 'otp', items: [{ cat: 'АЗС', pct: '5' }] }], denis: [], custom: ['Своя'], rev: { zhanna: 3, denis: 1, custom: 2 } };
  await put(path, JSON.stringify(legacy), { allowOverwrite: false });

  const m = lib.curMonth();
  const first = await lib.loadDoc(TEST_USER);
  assert.equal(first.legacy, false);
  assert.equal(first.doc.months[m].zhanna[0].bank, 'otp');
  assert.deepEqual(first.doc.custom, ['Своя']);
  assert.equal(first.doc.rev[`${m}:zhanna`], 3);
  assert.equal(first.doc.rev.custom, 2);

  const again = await lib.readDoc(TEST_USER);
  assert.equal(again.legacy, false, 'в хранилище уже новый формат');
});

test('curMonth и shiftMonth: переход через границу года', () => {
  assert.match(lib.curMonth(), /^\d{4}-(0[1-9]|1[0-2])$/);
  assert.equal(lib.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(lib.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(lib.shiftMonth('2026-10', 14), '2027-12');
});

// makeAuthHash проверяется косвенно (checkLogin), но формат фиксируем явно.
test('helpers: AUTH_HASH имеет вид salt:hash (hex, 64 байта хеша)', () => {
  const [salt, hash] = makeAuthHash('x').split(':');
  assert.match(salt, /^[0-9a-f]+$/);
  assert.equal(hash.length, 128);
});
