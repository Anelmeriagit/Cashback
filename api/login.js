import { checkLogin, makeCookie } from './_lib.js';

const fails = new Map(); // простая защита от перебора (в пределах одного инстанса)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '?';
  const f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60 * 1000) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 5) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { user, pass } = body || {};

  if (checkLogin(user, pass)) {
    fails.delete(ip);
    res.setHeader('Set-Cookie', makeCookie(process.env.AUTH_USER));
    return res.status(200).json({ ok: true });
  }
  f.n++; fails.set(ip, f);
  await new Promise((r) => setTimeout(r, 700));
  return res.status(401).json({ error: 'Неверный никнейм или пароль' });
}
