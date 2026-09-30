import { clearCookie } from './_lib.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', clearCookie);
  res.status(200).json({ ok: true });
}
