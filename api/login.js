import { checkLogin, makeCookie, loginState, loginFailed, loginOk } from './_lib.js';

const clientIp = (req) => String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '?';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const s = await loginState(clientIp(req));
  if (s.blocked) return res.status(429).json({ error: `Слишком много попыток. Подождите ${s.minutes} мин.` });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { user, pass } = body || {};

  if (checkLogin(user, pass)) {
    await loginOk(s);
    res.setHeader('Set-Cookie', makeCookie(process.env.AUTH_USER));
    return res.status(200).json({ ok: true });
  }
  await loginFailed(s);
  await new Promise((r) => setTimeout(r, 700));
  return res.status(401).json({ error: 'Неверный никнейм или пароль' });
}
