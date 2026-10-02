import crypto from 'node:crypto';
import * as B from '@vercel/blob';
import { session, renewCookie } from './_lib.js';
const { get, put } = B;

// Страница «Агент»: список строк «приложение — время сброса» в заданном порядке. Время по Москве.
// app — либо id встроенного приложения, либо своё название (строка до 40 символов, введённая вручную).
export const AGENT_APPS = ['app', 'opera', 'mozilla', 'edge'];
const LABELS = { app: 'app', opera: 'opera', mozilla: 'mozilla', edge: 'edge' };
export const AGENT_NAME_MAX = 40;
export const AGENT_MAX = 12; // не больше 12 строк
const PATH = 'agent/rows.json';
const ID_RE = /^[a-z0-9]{1,16}$/;
const isMissing = (e) => /not\s*found|404/i.test(String(e && (e.message || e.name)));

export const defaults = () => AGENT_APPS.map((app) => ({ id: app, app, h: null, m: null }));

// Название приложения: встроенный id (в том числе если введено как «Opera») или своё название без спецсимволов.
export function cleanApp(v) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || t.length > AGENT_NAME_MAX || /[<>"'`&\\\u0000-\u001f]/.test(t)) return null;
  return LABELS[t.toLowerCase()] || t;
}

// Серверная проверка: приложение (из списка или своё), часы 0–23, минуты 0–50 с шагом 10 (или не заданы).
export function cleanRows(list) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    const app = r && typeof r === 'object' ? cleanApp(r.app) : null;
    if (!app) continue;
    const id = typeof r.id === 'string' && ID_RE.test(r.id) && !seen.has(r.id) ? r.id : crypto.randomBytes(6).toString('hex');
    seen.add(id);
    const h = Number.isInteger(r.h) && r.h >= 0 && r.h <= 23 ? r.h : null;
    const m = Number.isInteger(r.m) && r.m >= 0 && r.m <= 50 && r.m % 10 === 0 ? r.m : null;
    out.push({ id, app, h, m });
  }
  return out;
}

async function readRows() {
  try {
    const r = await get(PATH, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return defaults();
    const raw = JSON.parse(await new Response(r.stream).text());
    return Array.isArray(raw && raw.rows) ? cleanRows(raw.rows).slice(0, AGENT_MAX) : defaults();
  } catch (e) {
    if (isMissing(e)) return defaults();
    throw e;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).end();
  if (!session(req)) return res.status(401).json({ error: 'auth' });
  const c = renewCookie(req);
  if (c) res.setHeader('Set-Cookie', c);
  try {
    if (req.method === 'GET') return res.status(200).json({ rows: await readRows() });
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
    if (!b || !Array.isArray(b.rows)) return res.status(400).json({ error: 'bad request' });
    if (b.rows.length > AGENT_MAX) return res.status(400).json({ error: 'limit' });
    const rows = cleanRows(b.rows);
    await put(PATH, JSON.stringify({ rows }), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    return res.status(200).json({ rows });
  } catch (e) {
    console.error('agent failed:', e.message);
    return res.status(500).json({ error: 'server' });
  }
}
