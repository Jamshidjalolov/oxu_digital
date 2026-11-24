// O'qituvchi sahnalari: jadval, darslar, davomat olish, statistika
const { Markup } = require('telegraf');
const api = require('../api');
const session = require('../session');
const keyboards = require('../keyboards');
const utils = require('../utils');

const PAGE_SIZE = 10;

// ---------- Menyu matnlari ----------

async function handleText(ctx, s, text) {
  if (text.includes('Mening darslarim')) return myLessons(ctx, s);
  if (text.includes('Haftalik jadval')) {
    session.reset(s);
    s.weekStart = utils.mondayOf();
    return renderSchedule(ctx, s, false);
  }
  if (text.includes('Statistika')) return stats(ctx, s);
  return ctx.reply('ℹ️ Iltimos, menyudagi tugmalardan foydalaning.');
}

// ---------- Haftalik jadval ----------

async function renderSchedule(ctx, s, edit) {
  const res = await api.get('/teacher/schedule', { token: s.token, params: { weekStart: s.weekStart } });
  const dates = res.dates && res.dates.length ? res.dates : Array.from({ length: 6 }, (_, i) => utils.addDays(s.weekStart, i));
  const lines = [`🗓 Haftalik jadval`, `${utils.shortDate(s.weekStart)} — ${utils.shortDate(utils.addDays(s.weekStart, 5))}`, ''];
  for (const d of dates) {
    lines.push(`📅 ${utils.humanDate(d)}`);
    const lessons = (res.byDay && res.byDay[d]) || [];
    if (!lessons.length) lines.push('   😴 Dars yo‘q');
    for (const l of lessons) {
      const groups = (l.groups || []).map((g) => g.name).join(', ');
      lines.push(`   🕐 ${l.pairNumber}-para ${l.startTime}-${l.endTime} · 📚 ${l.subject ? l.subject.name : ''} · 👥 ${groups} · 🚪 ${l.room}-xona`);
    }
  }
  if (!res.total) lines.push('\n😴 Bu hafta darslar yo‘q.');
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('◀ Oldingi hafta', 'tch:w:-1'), Markup.button.callback('Keyingi hafta ▶', 'tch:w:1')],
  ]);
  if (edit) {
    try {
      return await ctx.editMessageText(lines.join('\n'), kb);
    } catch (_) {
      return ctx.reply(lines.join('\n'), kb);
    }
  }
  return ctx.reply(lines.join('\n'), kb);
}

// ---------- Mening darslarim ----------

async function myLessons(ctx, s) {
  session.reset(s);
  const from = utils.todayISO();
  const to = utils.addDays(from, 7);
  const lessons = await api.get('/teacher/lessons', { token: s.token, params: { from, to } });
  if (!lessons.length) return ctx.reply('😴 Yaqin 7 kunda darslar yo‘q.');
  const rows = lessons.map((l) => [
    Markup.button.callback(
      `📚 ${l.subject ? l.subject.name : 'Dars'} · ${utils.shortDate(l.date)} ${l.startTime}`,
      `tch:l:${l._id}`
    ),
  ]);
  return ctx.reply('📒 Davomat olish uchun darsni tanlang:', Markup.inlineKeyboard(rows));
}

// ---------- Davomat olish ----------

async function openAttendance(ctx, s, lessonId) {
  const res = await api.get(`/teacher/lessons/${lessonId}/attendance`, { token: s.token });
  session.reset(s);
  s.flow = 'attendance';
  s.data = {
    lessonId,
    lesson: res.lesson,
    students: res.students || [],
    marks: {},
    page: 0,
    locked: Boolean(res.attendanceLocked),
    past: res.attendanceAllowed === false,
    attendanceMessage: res.attendanceMessage,
  };
  for (const st of res.students || []) {
    if (st.status) s.data.marks[st.id] = st.status;
  }
  const r = renderAttendance(s);
  await ctx.editMessageText(r.text, r.extra).catch(() => ctx.reply(r.text, r.extra));
}

function renderAttendance(s) {
  const d = s.data;
  const total = d.students.length;
  let present = 0;
  let absent = 0;
  for (const st of d.students) {
    if (d.marks[st.id] === 'present') present++;
    if (d.marks[st.id] === 'absent') absent++;
  }
  const l = d.lesson || {};
  const groups = (l.groups || []).map((g) => g.name).join(', ');
  const lines = [
    '📒 Davomat olish',
    `📚 ${l.subject ? l.subject.name : ''} — 📅 ${utils.humanDate(l.date)}`,
    `🕐 ${l.pairNumber}-para ${l.startTime}-${l.endTime} · 🚪 ${l.room}-xona · 👥 ${groups}`,
    `👥 Jami: ${total} · ✅ ${present} · ❌ ${absent}`,
  ];
  if (d.locked) lines.push('🔒 Davomat olingan — o‘zgartirib bo‘lmaydi');
  else if (d.past) lines.push(`⏳ ${d.attendanceMessage || 'Davomat faqat belgilangan dars vaqtida olinadi.'}`);
  else if (total) lines.push('ℹ️ Har bir talaba uchun ✅ yoki ❌ ni bosing.');
  lines.push('');
  const totalPages = Math.max(1, Math.ceil(d.students.length / PAGE_SIZE));
  const slice = d.students.slice(d.page * PAGE_SIZE, d.page * PAGE_SIZE + PAGE_SIZE);
  const rows = slice.map((st) => {
    const status = d.marks[st.id];
    const icon = status === 'present' ? ' ✅' : status === 'absent' ? ' ❌' : '';
    const name = st.fullName.length > 18 ? `${st.fullName.slice(0, 17)}…` : st.fullName;
    if (d.locked || d.past) return [Markup.button.callback(`${name}${icon || ' · —'}`, 'att:noop')];
    return [
      Markup.button.callback(`${name}${icon}`, 'att:noop'),
      Markup.button.callback('✅', `att:m:${st.id}:present`),
      Markup.button.callback('❌', `att:m:${st.id}:absent`),
    ];
  });
  if (totalPages > 1) rows.push(utils.pagerRow('att:pg', d.page, totalPages));
  if (!d.locked && !d.past) rows.push([Markup.button.callback('💾 Saqlash', 'att:save')]);
  if (d.past && !d.locked) rows.push([Markup.button.callback('🔄 Davomat vaqtini tekshirish', `tch:l:${d.lessonId}`)]);
  return { text: lines.join('\n'), extra: Markup.inlineKeyboard(rows) };
}

async function editAttendance(ctx, s) {
  const r = renderAttendance(s);
  try {
    await ctx.editMessageText(r.text, r.extra);
  } catch (_) {
    await ctx.reply(r.text, r.extra);
  }
}

async function saveAttendance(ctx, s) {
  const d = s.data;
  const records = d.students
    .filter((st) => d.marks[st.id] === 'present' || d.marks[st.id] === 'absent')
    .map((st) => ({ studentId: st.id, status: d.marks[st.id] }));
  try {
    await api.put(`/teacher/lessons/${d.lessonId}/attendance`, { records }, { token: s.token });
  } catch (e) {
    const message = e.response?.data?.message || 'Davomatni saqlab bo‘lmadi';
    if (e.response?.status === 409) {
      session.reset(s);
      await ctx.reply(`⚠️ ${message}`);
      return ctx.reply('👨‍🏫 O‘qituvchi menyusi. Tanlang:', keyboards.teacherMenu());
    }
    return ctx.reply(`⚠️ ${message}`);
  }
  session.reset(s);
  await ctx.reply('✅ Davomat saqlandi va qulflandi.');
  return ctx.reply('👨‍🏫 O‘qituvchi menyusi. Tanlang:', keyboards.teacherMenu());
}

// ---------- Statistika ----------

async function stats(ctx, s) {
  session.reset(s);
  const st = await api.get('/teacher/stats', { token: s.token });
  return ctx.reply([
    '📊 Davomat statistikasi',
    '',
    `👥 Jami belgilangan: ${st.total}`,
    `✅ Qatnashdi: ${st.present}`,
    `❌ Qatnashmadi: ${st.absent}`,
  ].join('\n'));
}

// ---------- Callback dispatch ----------

async function handleCallback(ctx, s) {
  const data = ctx.callbackQuery.data;
  const p = data.split(':');

  if (p[0] === 'tch' && p[1] === 'w') {
    await ctx.answerCbQuery();
    if (!s.weekStart) s.weekStart = utils.mondayOf();
    s.weekStart = utils.addDays(s.weekStart, Number(p[2]) * 7);
    return renderSchedule(ctx, s, true);
  }
  if (p[0] === 'tch' && p[1] === 'l') {
    await ctx.answerCbQuery();
    return openAttendance(ctx, s, p[2]);
  }

  // --- Davomat ---
  if (p[0] === 'att') {
    if (s.flow !== 'attendance') return ctx.answerCbQuery();
    if (data === 'att:noop') return ctx.answerCbQuery();
    if (s.data.locked && (p[1] === 'm' || p[1] === 'save')) {
      return ctx.answerCbQuery('Davomat allaqachon olingan va o‘zgartirilmaydi.', true);
    }
    if (s.data.past && (p[1] === 'm' || p[1] === 'save')) {
      return ctx.answerCbQuery('Davomat faqat belgilangan dars vaqtida olinadi.', true);
    }
    if (p[1] === 'pg') {
      await ctx.answerCbQuery();
      if (p[2] === 'noop') return;
      s.data.page = Number(p[2]);
      return editAttendance(ctx, s);
    }
    if (p[1] === 'm') {
      s.data.marks[p[2]] = s.data.marks[p[2]] === p[3] ? null : p[3];
      await ctx.answerCbQuery(p[3] === 'present' ? '✅ Qatnashdi' : '❌ Qatnashmadi');
      return editAttendance(ctx, s);
    }
    if (p[1] === 'save') {
      await ctx.answerCbQuery();
      return saveAttendance(ctx, s);
    }
  }
  return ctx.answerCbQuery();
}

module.exports = { handleText, handleCallback };
