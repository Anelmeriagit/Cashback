import { session, loadData, saveData, clean } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = session(req);
  if (!user) return res.status(401).json({ error: 'auth' });
  try {
    if (req.method === 'GET') return res.status(200).json({ user, data: await loadData(user) });
    if (req.method === 'PUT') {
      if (!String(req.headers['content-type'] || '').includes('application/json')) return res.status(415).end();
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      await saveData(user, clean(body));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'storage' });
  }
}
