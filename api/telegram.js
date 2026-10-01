import { loadDoc } from './_lib.js';
import { PERSONS, REMINDERS, whoIs, tg, mutate, readState, markDone, isFilled, targetMonth, webhookSecret, safeEq, mskNow, cashbackTexts, chunkText } from './_bot.js';

const CM_RE = /^\d{4}-\d{2}$/;

async function onMessage(m) {
  const p = await whoIs(m.from);
  // Чужие и групповые чаты: полная тишина.
  if (!p || !m.chat || m.chat.type !== 'private') return;
  if (/^\/start(\s|@|$)/i.test(String(m.text || ''))) {
    await mutate((st) => { st.users[p] = { chat: m.chat.id, username: m.from.username, id: m.from.id }; });
    await tg('sendMessage', { chat_id: m.chat.id, text: `Привет, ${PERSONS[p].name}! Бот подключён: напоминания будут приходить сюда. Список кешбэков — в меню слева от поля ввода.` });
    return;
  }
  if (/^\/cashback(\s|@|$)/i.test(String(m.text || ''))) {
    let texts;
    try { texts = cashbackTexts((await loadDoc(process.env.AUTH_USER)).doc, mskNow().month); }
    catch (e) {
      console.error(e);
      return tg('sendMessage', { chat_id: m.chat.id, text: 'Не удалось загрузить данные с сайта. Попробуйте чуть позже.' });
    }
    for (const t of texts) for (const part of chunkText(t)) await tg('sendMessage', { chat_id: m.chat.id, text: part });
  }
}

async function onCallback(cq) {
  const p = await whoIs(cq.from);
  if (!p) return;
  const ans = (extra) => tg('answerCallbackQuery', { callback_query_id: cq.id, ...extra }).catch(() => {});
  const [act, id, cm] = String(cq.data || '').split('|');
  const R = REMINDERS[id];
  if (!R || !R.who.includes(p) || !CM_RE.test(cm || '') || !['ok', 'chk', 'later'].includes(act) || !cq.message) return ans();

  const chat = cq.message.chat.id, mid = cq.message.message_id;
  const edit = (text, kb) => tg('editMessageText', { chat_id: chat, message_id: mid, text, reply_markup: { inline_keyboard: kb || [] } })
    .catch((e) => { if (!/not modified/i.test(e.message)) throw e; });

  if (act === 'later') {
    await ans();
    return edit(`${R.text}\n\n⏰ Напомню по расписанию.`);
  }

  if (id === 'cashback') {
    const { state } = await readState();
    const c = state.cycles[id + ':' + cm];
    if (!(c && c.done && c.done[p])) {
      let filled;
      try { filled = await isFilled(p, targetMonth(cm)); }
      catch (e) {
        console.error(e);
        return ans({ text: 'Не удалось проверить сайт. Попробуйте чуть позже.', show_alert: true });
      }
      if (!filled) {
        await ans({ text: 'Категории на сайте пока не заполнены' });
        return edit('Проверка не пройдена. Категории на сайте не заполнены', [[{ text: 'Проверить', callback_data: `chk|cashback|${cm}` }]]);
      }
      await markDone(id, cm, p);
    }
    await ans();
    return edit(R.doneText);
  }

  await markDone(id, cm, p);
  await ans();
  return edit(`${R.text}\n\n✅ ${R.doneLabel}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!safeEq(req.headers['x-telegram-bot-api-secret-token'] || '', webhookSecret())) return res.status(401).end();
  let u = null;
  try {
    u = req.body;
    if (typeof u === 'string') u = JSON.parse(u);
    if (u && u.callback_query) await onCallback(u.callback_query);
    else if (u && u.message) await onMessage(u.message);
  } catch (e) {
    console.error(e);
    // Пользователь не должен остаться без ответа: кнопка не «зависает», команда не молчит.
    try {
      const cq = u && u.callback_query, m = u && u.message;
      if (cq) await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Не получилось. Попробуйте ещё раз через минуту.', show_alert: true }, { retries: 0 });
      else if (m && m.chat && m.chat.type === 'private' && await whoIs(m.from)) await tg('sendMessage', { chat_id: m.chat.id, text: 'Что-то пошло не так. Попробуйте ещё раз чуть позже.' }, { retries: 0 });
    } catch (e2) { console.error('error reply failed', e2.message); }
  }
  // Всегда 200, иначе Telegram будет слать то же обновление повторно.
  return res.status(200).json({ ok: true });
}
