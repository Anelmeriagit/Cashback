import { session, readDoc, writeDoc, clean, cleanRev, isPrecond, PARTS } from './_lib.js';

const pub = (doc) => ({ zhanna: doc.zhanna, denis: doc.denis, custom: doc.custom });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = session(req);
  if (!user) return res.status(401).json({ error: 'auth' });
  try {
    if (req.method === 'GET') {
      const { doc } = await readDoc(user);
      return res.status(200).json({ user, data: pub(doc), rev: doc.rev });
    }
    if (req.method === 'PUT') {
      if (!String(req.headers['content-type'] || '').includes('application/json')) return res.status(415).end();
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const parts = body && typeof body.parts === 'object' && body.parts ? body.parts : {};
      const names = Object.keys(parts).filter((k) => PARTS.includes(k));
      if (!names.length || names.some((k) => !parts[k] || !Number.isInteger(parts[k].base) || !Array.isArray(parts[k].value))) {
        return res.status(400).json({ error: 'bad request' });
      }
      let prevSig = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { doc, etag } = await readDoc(user);
        // Версия столбца изменилась с момента загрузки на устройстве -> конфликт, ничего не пишем.
        const bad = names.filter((k) => parts[k].base !== doc.rev[k]);
        if (bad.length) return res.status(409).json({ error: 'conflict', parts: bad, data: pub(doc), rev: doc.rev });
        const merged = pub(doc);
        names.forEach((k) => { merged[k] = parts[k].value; });
        const next = { ...clean(merged), rev: { ...doc.rev } };
        names.forEach((k) => { next.rev[k] = doc.rev[k] + 1; });
        const sig = JSON.stringify(doc.rev);
        // Если версии не менялись, а ETag всё равно не совпал, чужой записи не было: пишем без ifMatch.
        const force = prevSig !== null && sig === prevSig;
        if (force) console.warn('blob etag mismatch without rev change, forcing write');
        try {
          await writeDoc(user, next, etag, force);
          return res.status(200).json({ ok: true, rev: cleanRev(next.rev) });
        } catch (e) {
          if (!isPrecond(e)) throw e;
          prevSig = sig;
        }
      }
      return res.status(409).json({ error: 'busy' });
    }
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'storage' });
  }
}
