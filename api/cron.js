import { REMINDERS, TEST_CYCLE, mskNow, mutate, readState, planDue, linkedOf, sendReminder, authed } from './_bot.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!authed(req)) return res.status(401).json({ error: 'auth' });
  const q = req.query || {};
  try {
    // Ручной тест внешнего вида и кнопок: /api/cron?key=...&send=halva
    // Расписание и отметки реальных циклов не затрагивает (отдельный тестовый цикл).
    if (q.send) {
      const R = REMINDERS[q.send];
      if (!R) return res.status(400).json({ error: 'unknown reminder', ids: Object.keys(REMINDERS) });
      await mutate((st) => { delete st.cycles[q.send + ':' + TEST_CYCLE]; });
      const { state } = await readState();
      const sent = await Promise.all(R.who.map(async (p) => {
        const chat = state.users[p] && state.users[p].chat;
        if (!chat) return { p, ok: false, error: 'нет /start' };
        try { await sendReminder(chat, q.send, TEST_CYCLE); return { p, ok: true }; }
        catch (e) { return { p, ok: false, error: e.message }; }
      }));
      return res.status(200).json({ test: true, sent });
    }

    // Сухой прогон: /api/cron?key=...&dry=1[&date=2026-10-25] — ничего не отправляет и не записывает.
    if (q.dry === '1') {
      let now = mskNow();
      if (q.date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return res.status(400).json({ error: 'date: YYYY-MM-DD' });
        now = { month: q.date.slice(0, 7), date: q.date };
      }
      const { state } = await readState();
      const plan = planDue(JSON.parse(JSON.stringify(state)), now, q.slot);
      return res.status(200).json({ dry: true, date: now.date, linked: linkedOf(state), would_send: plan.map(({ id, p, cycle }) => ({ id, p, cycle })) });
    }
    if (q.date) return res.status(400).json({ error: 'date работает только с dry=1' });

    const now = mskNow();
    // Два запуска в сутки: «day» (14:00–15:00 МСК) и «evening» (18:00–19:00 МСК, /api/cron?slot=evening)
    const slot = q.slot === 'evening' ? 'evening' : 'day';
    const claims = await mutate((st) => planDue(st, now, slot));
    const sent = await Promise.all(claims.map(async (c) => {
      try { await sendReminder(c.chat, c.id, c.cycle); return { id: c.id, p: c.p, ok: true }; }
      catch (e) { console.error('send failed', c.id, c.p, e.message); return { id: c.id, p: c.p, ok: false, error: e.message }; }
    }));
    return res.status(200).json({ date: now.date, slot, sent });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'failed', message: e.message });
  }
}
