// Admin sahnalari: rol berish, dars biriktirish, foydalanuvchilar, hisobot
const { Markup } = require('telegraf');
const { randomBytes } = require('node:crypto');
const api = require('../api');
const session = require('../session');
const keyboards = require('../keyboards');
const utils = require('../utils');

const PAGE_SIZE = 10;
const PRIVATE_ADMIN_TEXT = 'Faqat administrator uchun, shaxsiy chatda.';
const ACTIVE_FLOW_TEXT = 'Avval joriy amalni tugating yoki bekor qiling.';

function isPrivateAdmin(ctx, s) {
  return ctx.chat?.type === 'private' && !!s.token && s.user?.role === 'admin';
}

function clearCredentials(s, data) {
  delete data.password;
  if (s.data === data) session.reset(s);
}

async function replyCredentials(ctx, s, title, phone, password) {
  if (!isPrivateAdmin(ctx, s)) return;
  const text = `${title}\nLogin (telefon): ${phone}\nParol: ${password}\n\nDiqqat: login va parol ushbu shaxsiy Telegram chatida qoladi. Ularni xavfsiz saqlang va xabarlarni o‘chiring.`;
  try {
    return await ctx.reply(text, { ...keyboards.adminMenu(), protect_content: true });
  } catch (_) {
    // Telegram xatosi yuborilgan parolni o‘z ichiga olishi mumkin.
    return ctx.reply('Amal bajarildi, lekin kirish ma’lumotlarini yuborib bo‘lmadi. Zarur bo‘lsa, parolni qayta yangilang.');
  }
}

// ---------- Menyu matnlari ----------

async function handleText(ctx, s, text) {
  if (!isPrivateAdmin(ctx, s)) return ctx.reply(PRIVATE_ADMIN_TEXT);
  if (s.flow) return ctx.reply(ACTIVE_FLOW_TEXT);
  if (text.includes('Hisob yaratish')) return startCreateUser(ctx, s);
  if (text.includes('Rol berish')) return startUserList(ctx, s, { mode: 'promote', role: 'student' });
  if (text.includes('Foydalanuvchilar')) return startUserList(ctx, s, { mode: 'browse', role: '' });
  if (text.includes('Hisobot')) return report(ctx, s);
  if (text.includes('Dars biriktirish')) return startAssign(ctx, s);
  return ctx.reply('ℹ️ Iltimos, menyudagi tugmalardan foydalaning.');
}

// ---------- Hisob yaratish (faqat administrator) ----------

function createUserKB(confirm = false) {
  const rows = [];
  if (confirm) rows.push([Markup.button.callback('Hisob yaratish', 'adm:cu:ok')]);
  rows.push([Markup.button.callback('Bekor qilish', 'adm:cu:cancel')]);
  return Markup.inlineKeyboard(rows);
}

function startCreateUser(ctx, s) {
  session.reset(s);
  s.flow = 'createUser';
  s.step = 'fullName';
  return ctx.reply('📝 Yangi hisob yaratamiz.\n\n👤 To‘liq F.I.O ni kiriting:', createUserKB());
}

function cancelCreateUser(ctx, s) {
  delete s.data.password;
  session.reset(s);
  return ctx.reply('❌ Hisob yaratish bekor qilindi.\n\n🛡 Admin paneli. Menyudan tanlang:', keyboards.adminMenu());
}

async function handleCreateUserText(ctx, s, text) {
  if (!isPrivateAdmin(ctx, s)) return ctx.reply(PRIVATE_ADMIN_TEXT);
  if (s.flow !== 'createUser') return;
  if (s.step === 'saving' || s.step === 'loadingGroups') {
    if (s.step === 'loadingGroups' && text.trim() === 'Bekor qilish') return cancelCreateUser(ctx, s);
    return ctx.reply('So‘rov bajarilmoqda. Iltimos, kuting.');
  }
  const value = text.trim();
  if (value === 'Bekor qilish') return cancelCreateUser(ctx, s);
  if (s.step === 'fullName') {
    if (value.length < 3) return ctx.reply('⚠️ F.I.O juda qisqa. Qayta kiriting:', createUserKB());
    s.data.fullName = value;
    s.step = 'phone';
    return ctx.reply('📱 Telefon raqamini kiriting (9 ta raqam):', createUserKB());
  }
  if (s.step === 'phone') {
    if (!/^\d{9}$/.test(value)) return ctx.reply('⚠️ Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak:', createUserKB());
    s.data.phone = value;
    s.step = 'password';
    return ctx.reply('🔑 Parolni kiriting (kamida 6 belgi, ko‘pi bilan 72 UTF-8 bayt):', createUserKB());
  }
  if (s.step === 'password') {
    if (Array.from(text).length < 6 || Buffer.byteLength(text, 'utf8') > 72) {
      return ctx.reply('⚠️ Parol kamida 6 belgi va ko‘pi bilan 72 UTF-8 bayt bo‘lishi kerak. Qayta kiriting:', createUserKB());
    }
    s.data.password = text;
    s.step = 'role';
    return ctx.reply('🔰 Yangi hisob rolini tanlang:', keyboards.createUserRoleKB());
  }
  return ctx.reply('Iltimos, tugmalardan foydalaning.', createUserKB(s.step === 'confirm'));
}

function confirmCreateUser(ctx, s) {
  s.step = 'confirm';
  const d = s.data;
  const lines = ['📋 Yangi hisob:', `👤 F.I.O: ${d.fullName}`, `📱 Login (telefon): ${d.phone}`, `🔰 Rol: ${roleLabel(d.role)}`];
  if (d.role === 'student') lines.push(`Guruh: ${d.groupName}`);
  lines.push('', 'Hisobni yaratishni tasdiqlaysizmi?');
  return ctx.reply(lines.join('\n'), createUserKB(true));
}

function createUserError(ctx, s, err) {
  // API xatosi parolni aks ettirishi mumkin: asl xatoni qaytarmaymiz yoki logga yozmaymiz.
  let message = String(utils.errText(err));
  const password = s.data.password;
  clearCredentials(s, s.data);
  if (err && err.response && err.response.status === 401) {
    return utils.handleError(ctx, s, { response: { status: 401 } });
  }
  if (password) {
    const secrets = new Set([password, JSON.stringify(password).slice(1, -1)]);
    try { secrets.add(encodeURIComponent(password)); } catch (_) { /* noto‘liq Unicode */ }
    for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
      message = message.split(secret).join('[yashirilgan]');
    }
  }
  return ctx.reply(`⚠️ Xatolik: ${message}\nKiritilgan parol sessiyadan o‘chirildi. Amalni qayta boshlang.`, keyboards.adminMenu());
}

function currentCredentialRequest(ctx, s, flow, data, token, adminId) {
  return isPrivateAdmin(ctx, s) && s.flow === flow && s.data === data &&
    s.token === token && s.user.id === adminId;
}

async function finishCreateUser(ctx, s) {
  const d = s.data;
  const token = s.token;
  const adminId = s.user.id;
  const current = () => currentCredentialRequest(ctx, s, 'createUser', d, token, adminId);
  const body = { fullName: d.fullName, phone: d.phone, password: d.password, role: d.role };
  if (d.role === 'student') body.groupId = d.groupId;
  s.step = 'saving';
  try { await ctx.answerCbQuery(); } catch (_) { /* eskirgan callback so‘rovni to‘xtatmasin */ }
  if (!current()) return clearCredentials(s, d);
  try {
    await api.post('/admin/users', body, { token });
  } catch (err) {
    if (!current()) return clearCredentials(s, d);
    return createUserError(ctx, s, err);
  }
  const password = d.password;
  const canDisplay = current();
  clearCredentials(s, d);
  if (canDisplay) return replyCredentials(ctx, s, 'Hisob yaratildi.', d.phone, password);
}

async function handleCreateUserCallback(ctx, s) {
  if (s.flow !== 'createUser') return ctx.answerCbQuery();
  const data = ctx.callbackQuery.data;
  const p = data.split(':');
  if (s.step === 'saving') return ctx.answerCbQuery('So‘rov bajarilmoqda. Iltimos, kuting.');
  if (data === 'adm:cu:cancel') {
    await ctx.answerCbQuery();
    return cancelCreateUser(ctx, s);
  }
  if (p.length === 4 && p[2] === 'role' && s.step === 'role') {
    const role = p[3];
    if (!['student', 'teacher', 'admin'].includes(role)) return ctx.answerCbQuery('Noto‘g‘ri rol', true);
    const d = s.data;
    d.role = role;
    if (role !== 'student') {
      delete d.groupId;
      delete d.groupName;
      s.step = 'summary';
      try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
      if (s.flow !== 'createUser' || s.data !== d || s.step !== 'summary') return;
      return confirmCreateUser(ctx, s);
    }
    s.step = 'loadingGroups';
    try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
    try {
      const groups = await api.get('/admin/groups', { token: s.token });
      if (s.flow !== 'createUser' || s.data !== d) return;
      d.groups = groups;
    } catch (err) {
      if (s.flow !== 'createUser' || s.data !== d) return;
      return createUserError(ctx, s, err);
    }
    if (!d.groups.length) {
      s.step = 'role';
      return ctx.reply('Guruhlar topilmadi. Avval guruh yarating yoki boshqa rolni tanlang.', keyboards.createUserRoleKB());
    }
    s.step = 'group';
    // Qisqa sessiya tanlov IDlari: guruh nomi va haqiqiy ID faqat sessiyada saqlanadi.
    const rows = d.groups.map((g, id) => [Markup.button.callback(g.name, `adm:cu:group:${id}`)]);
    rows.push([Markup.button.callback('Bekor qilish', 'adm:cu:cancel')]);
    return ctx.reply('Mavjud guruhni tanlang:', Markup.inlineKeyboard(rows));
  }
  if (p.length === 4 && p[2] === 'group' && s.step === 'group') {
    const group = /^(0|[1-9]\d*)$/.test(p[3]) && s.data.groups[Number(p[3])];
    if (!group || group.id == null) return ctx.answerCbQuery('Guruh topilmadi', true);
    const d = s.data;
    d.groupId = group.id;
    d.groupName = group.name;
    s.step = 'summary';
    try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
    if (s.flow !== 'createUser' || s.data !== d || s.step !== 'summary') return;
    return confirmCreateUser(ctx, s);
  }
  if (data === 'adm:cu:ok' && s.step === 'confirm') return finishCreateUser(ctx, s);
  return ctx.answerCbQuery();
}

// ---------- Mavjud hisob parolini almashtirish ----------

function resetPasswordKB(d, confirm = false) {
  const rows = [];
  if (confirm) rows.push([Markup.button.callback('Tasdiqlash va saqlash', `adm:rp:ok:${d.requestId}`)]);
  rows.push([Markup.button.callback('Bekor qilish', `adm:rp:cancel:${d.requestId}`)]);
  return Markup.inlineKeyboard(rows);
}

function cancelResetPassword(ctx, s) {
  clearCredentials(s, s.data);
  return ctx.reply('❌ Parolni yangilash bekor qilindi. Parol o‘zgartirilmadi.', keyboards.adminMenu());
}

async function handleResetPasswordText(ctx, s, text) {
  if (!isPrivateAdmin(ctx, s)) return ctx.reply(PRIVATE_ADMIN_TEXT);
  if (s.flow !== 'resetPassword') return;
  if (s.step === 'saving') return ctx.reply('So‘rov bajarilmoqda. Iltimos, kuting.');
  if (text.trim() === 'Bekor qilish') return cancelResetPassword(ctx, s);
  const d = s.data;
  if (s.step !== 'enter') return ctx.reply('Iltimos, tugmalardan foydalaning.', resetPasswordKB(d, s.step === 'confirm'));
  if (Array.from(text).length < 6 || Buffer.byteLength(text, 'utf8') > 72) {
    return ctx.reply('⚠️ Parol kamida 6 belgi va ko‘pi bilan 72 UTF-8 bayt bo‘lishi kerak. Qayta kiriting:', resetPasswordKB(d));
  }
  d.password = text;
  s.step = 'confirm';
  try {
    return await ctx.reply(
      `👤 F.I.O: ${d.fullName}\n📱 Login (telefon): ${d.phone}\n\n⚠️ Tasdiqlash va saqlashdan keyin eski parol ishlamaydi.\n🔑 Yangi parolni saqlaysizmi?`,
      resetPasswordKB(d, true)
    );
  } catch (_) {
    clearCredentials(s, d);
    return ctx.reply('Tasdiqlash xabarini yuborib bo‘lmadi. Parol o‘zgartirilmadi. Amalni qayta boshlang.');
  }
}

async function finishResetPassword(ctx, s) {
  const d = s.data;
  const token = s.token;
  const adminId = s.user.id;
  const current = () => currentCredentialRequest(ctx, s, 'resetPassword', d, token, adminId);
  s.step = 'saving';
  try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
  if (!current()) return clearCredentials(s, d);
  try {
    await api.put(`/admin/users/${encodeURIComponent(d.userId)}`, { password: d.password }, { token });
  } catch (err) {
    if (!current()) return clearCredentials(s, d);
    return createUserError(ctx, s, err);
  }
  const password = d.password;
  const canDisplay = current();
  clearCredentials(s, d);
  if (canDisplay) return replyCredentials(ctx, s, 'Parol yangilandi.', d.phone, password);
}

async function handleResetPasswordCallback(ctx, s) {
  const p = ctx.callbackQuery.data.split(':');
  if (p[2] === 'start' && p.length === 5) {
    if (s.flow) return ctx.answerCbQuery(ACTIVE_FLOW_TEXT);
    if (!s.admin || s.admin.mode !== 'browse' || p[3] !== s.admin.resetId) return ctx.answerCbQuery();
    const user = s.admin.users.find((u) => String(u.id) === p[4]);
    if (!user || user.id == null || !['student', 'teacher'].includes(user.role)) return ctx.answerCbQuery('Foydalanuvchi topilmadi');
    session.reset(s);
    s.flow = 'resetPassword';
    s.step = 'enter';
    const d = s.data = { userId: user.id, fullName: user.fullName, phone: user.phone, requestId: randomBytes(6).toString('hex') };
    try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
    if (!isPrivateAdmin(ctx, s) || s.flow !== 'resetPassword' || s.data !== d) return;
    return ctx.reply(
      `👤 F.I.O: ${d.fullName}\n📱 Login (telefon): ${d.phone}\n\nℹ️ Eski parolni ko‘rib yoki tiklab bo‘lmaydi. U faqat tasdiqlash va saqlashdan keyin ishlamaydi.\n🔑 Yangi parolni kiriting (kamida 6 belgi, ko‘pi bilan 72 UTF-8 bayt). Parol shaxsiy Telegram chatida qoladi.`,
      resetPasswordKB(d)
    );
  }
  if (s.flow !== 'resetPassword' || p.length !== 4 || p[3] !== s.data.requestId) return ctx.answerCbQuery();
  if (s.step === 'saving') return ctx.answerCbQuery('So‘rov bajarilmoqda. Iltimos, kuting.');
  if (p[2] === 'cancel' && ['enter', 'confirm'].includes(s.step)) {
    const reply = await cancelResetPassword(ctx, s);
    try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
    return reply;
  }
  if (p[2] === 'ok' && s.step === 'confirm') return finishResetPassword(ctx, s);
  return ctx.answerCbQuery();
}

// ---------- Foydalanuvchilar ro'yxati (rol berish / ko'rish) ----------

async function fetchUsers(s) {
  const params = {};
  if (s.admin.role) params.role = s.admin.role;
  s.admin.users = await api.get('/admin/users', { token: s.token, params });
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'teacher') return 'O‘qituvchi';
  return 'Talaba';
}

function renderUserList(s) {
  const { mode, role, page, users } = s.admin;
  // Ro‘yxat qayta chizilganda eski parol tugmalari ishlamasin.
  s.admin.resetId = randomBytes(6).toString('hex');
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const slice = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const title = mode === 'promote' ? '🎓 Talabalar (rol berish)' : '👥 Foydalanuvchilar';
  const lines = [`${title} — ${users.length} ta`, ''];
  const rows = [];

  slice.forEach((u, i) => {
    const num = page * PAGE_SIZE + i + 1;
    const groupName = u.group ? ` · 🎓 ${u.group.name}` : '';
    lines.push(`${num}. 👤 ${u.fullName} — 📱 Login (telefon): ${u.phone} (${roleLabel(u.role)}${groupName})`);
    if (mode === 'promote') {
      rows.push([
        Markup.button.callback(`${num}. ${u.fullName}`, 'adm:noop'),
        Markup.button.callback('⬆️ O‘qituvchi qilish', `adm:promote:${u.id}`),
      ]);
    } else {
      rows.push([Markup.button.callback(`${num}. ${u.fullName} — ${roleLabel(u.role)}`, 'adm:noop')]);
      if (['student', 'teacher'].includes(u.role) && u.id != null) {
        rows.push([Markup.button.callback(`🔑 ${num}. Parolni yangilash`, `adm:rp:start:${s.admin.resetId}:${u.id}`)]);
      }
    }
    if (!u.approved) rows.push([Markup.button.callback(`✅ ${num}. Hisobni tasdiqlash`, `adm:approve:${u.id}`)]);
  });

  if (!slice.length) lines.push('😴 Hech kim topilmadi.');

  if (mode === 'browse') {
    rows.push([
      Markup.button.callback('👥 Barcha', 'adm:filter:'),
      Markup.button.callback('👨‍🏫 O‘qituvchi', 'adm:filter:teacher'),
      Markup.button.callback('🎓 Talaba', 'adm:filter:student'),
    ]);
  }
  rows.push(utils.pagerRow('adm:page', page, totalPages));
  rows.push([Markup.button.callback('⬅️ Menyu', 'adm:menu')]);

  return { text: lines.join('\n'), extra: Markup.inlineKeyboard(rows) };
}

async function startUserList(ctx, s, { mode, role }) {
  session.reset(s);
  s.admin = { mode, role, page: 0, users: [] };
  await fetchUsers(s);
  const r = renderUserList(s);
  return ctx.reply(r.text, r.extra);
}

async function editUserList(ctx, s) {
  const r = renderUserList(s);
  try {
    await ctx.editMessageText(r.text, r.extra);
  } catch (_) {
    await ctx.reply(r.text, r.extra);
  }
}

async function showUserDetails(ctx, s, userId) {
  const u = s.admin.users.find((x) => String(x.id) === String(userId));
  if (!u) return ctx.answerCbQuery('Foydalanuvchi topilmadi', true);
  const groupName = u.group ? `\n🎓 Guruh: ${u.group.name}` : '';
  const text = `👤 ${u.fullName}\n📱 ${u.phone}\n🔰 Rol: ${roleLabel(u.role)}${groupName}\n\n⬆️ O‘qituvchi qilmoqchimisiz?`;
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Ha, o‘qituvchi qilish', `adm:promote:ok:${u.id}`)],
    [Markup.button.callback('❌ Bekor qilish', 'adm:promote:no')],
  ]);
  await ctx.answerCbQuery();
  return ctx.editMessageText(text, kb);
}

async function promoteUser(ctx, s, userId) {
  const u = s.admin.users.find((x) => String(x.id) === String(userId));
  if (!u) return ctx.answerCbQuery('Foydalanuvchi topilmadi', true);
  // API butun maydonlarni almashtiradi, shuning uchun to'liq yuboramiz
  await api.put(
    `/admin/users/${userId}`,
    { fullName: u.fullName, phone: u.phone, role: 'teacher', approved: true },
    { token: s.token }
  );
  s.admin.page = 0;
  await fetchUsers(s);
  await ctx.answerCbQuery('Rol yangilandi ✅');
  return editUserList(ctx, s);
}

// ---------- Hisobot ----------

async function report(ctx, s) {
  session.reset(s);
  const weekStart = utils.mondayOf();
  const lessons = await api.get('/admin/lessons', { token: s.token, params: { weekStart } });
  const byDay = {};
  for (const l of lessons) byDay[l.date] = (byDay[l.date] || 0) + 1;
  const dates = Array.from({ length: 6 }, (_, i) => utils.addDays(weekStart, i));
  const lines = [
    `📊 Haftalik hisobot`,
    `🗓 ${utils.humanDate(weekStart)} — ${utils.humanDate(dates[5])}`,
    `📚 Jami darslar: ${lessons.length} ta`,
    '',
  ];
  for (const d of dates) {
    lines.push(`• ${utils.humanDate(d)}: ${byDay[d] || 0} ta dars`);
  }
  return ctx.reply(lines.join('\n'));
}

// ---------- Dars biriktirish (wizard) ----------

async function startAssign(ctx, s) {
  session.reset(s);
  s.flow = 'assign';
  s.step = 'teacher';
  s.data = { groups: [], groupNames: {} };
  const teachers = await api.get('/admin/users', { token: s.token, params: { role: 'teacher' } });
  s.data.teachers = teachers.filter((t) => t.approved);
  if (!s.data.teachers.length) return ctx.reply('😴 Tasdiqlangan o‘qituvchilar topilmadi.');
  const kb = Markup.inlineKeyboard(s.data.teachers.map((t) => [Markup.button.callback(`👨‍🏫 ${t.fullName}`, `adm:asg:t:${t.id}`)]));
  return ctx.reply('1️⃣ O‘qituvchini tanlang:', kb);
}

function renderGroupPicker(s) {
  const lines = ['3️⃣ Guruhlarni tanlang (bir nechtasini belgilash mumkin):'];
  const rows = s.data.allGroups.map((g) => {
    const mark = s.data.groups.includes(g.id) ? '✅ ' : '';
    return [Markup.button.callback(`${mark}${g.name}`, `adm:asg:g:${g.id}`)];
  });
  rows.push([Markup.button.callback('✅ Tasdiqlash', 'adm:asg:gdone')]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'adm:asg:cancel')]);
  return { text: lines.join('\n'), extra: Markup.inlineKeyboard(rows) };
}

function assignSummary(s) {
  const d = s.data;
  return [
    '📝 Darsni biriktirish',
    `👤 O‘qituvchi: ${d.teacherName}`,
    `📚 Fan: ${d.subjectName}`,
    `👥 Guruhlar: ${d.groupNamesList.join(', ')}`,
    `📅 Sana: ${d.date}`,
    `🕐 Vaqt: ${d.startTime}-${d.endTime}`,
    `🔢 Para: ${d.pairNumber}`,
    `🏢 Xona: ${d.room}${d.building ? ` (${d.building})` : ''}`,
    `📖 Tur: ${d.type}`,
    '',
    'Barchasi to‘g‘rimi?',
  ].join('\n');
}

async function showSlots(ctx, s) {
  const d = s.data;
  const res = await api.get('/admin/lesson-slots', { token: s.token, params: { date: d.date, teacherId: d.teacherId, groupIds: d.groups.join(',') } });
  d.slots = res.slots || [];
  if (!d.slots.length) {
    s.step = 'date';
    return ctx.reply('😕 Bu kunda tanlangan o‘qituvchi va guruhlar uchun bo‘sh vaqt yo‘q.\n4️⃣ Boshqa sana kiriting (YYYY-MM-DD):');
  }
  s.step = 'pair';
  const rows = d.slots.map((slot) => [Markup.button.callback(`🕐 ${slot.pairNumber}-para · ${slot.startTime}–${slot.endTime}`, `adm:asg:p:${slot.pairNumber}`)]);
  rows.push([Markup.button.callback('❌ Bekor qilish', 'adm:asg:cancel')]);
  return ctx.reply('5️⃣ Bo‘sh vaqtni tanlang:', Markup.inlineKeyboard(rows));
}

async function handleAssignText(ctx, s, text) {
  const d = s.data;
  if (s.step === 'date') {
    if (!utils.isValidDate(text)) return ctx.reply('⚠️ Noto‘g‘ri sana. Format: YYYY-MM-DD (masalan: 2026-11-10)');
    if (text < utils.addDays(utils.todayISO(), 1)) return ctx.reply('⚠️ Darsni kamida bir kun oldin biriktirish mumkin. Sanani qayta kiriting (YYYY-MM-DD):');
    d.date = text;
    return showSlots(ctx, s);
  }
  if (s.step === 'room') {
    const parts = text.split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return ctx.reply("⚠️ Noto‘g‘ri format. Masalan: 306-4-o'quv bino (xona-bino)");
    d.room = parts[0];
    d.building = parts.slice(1).join('-');
    s.step = 'type';
    return ctx.reply('6️⃣ Dars turini tanlang:', keyboards.lessonTypeKB('adm:asg:ty'));
  }
  return ctx.reply('Iltimos, ko‘rsatmalarga amal qiling.');
}

async function finishAssign(ctx, s) {
  const d = s.data;
  const payload = {
    teacherId: d.teacherId,
    subjectId: d.subjectId,
    groupIds: d.groups,
    date: d.date,
    startTime: d.startTime,
    endTime: d.endTime,
    pairNumber: d.pairNumber,
    room: d.room,
    building: d.building,
    type: d.type,
  };
  try {
    await api.post('/admin/lessons', payload, { token: s.token });
  } catch (e) {
    const message = e.response?.data?.message || 'Dars biriktirishda xatolik';
    session.reset(s);
    return ctx.reply(`⚠️ ${message}\n\n🛡 Admin paneli. Menyudan tanlang:`, keyboards.adminMenu());
  }
  session.reset(s);
  await ctx.reply('🎉 Dars muvaffaqiyatli biriktirildi!');
  return ctx.reply('🛡 Admin paneli. Menyudan tanlang:', keyboards.adminMenu());
}

// ---------- Callback dispatch ----------

async function handleCallback(ctx, s) {
  if (!isPrivateAdmin(ctx, s)) return ctx.answerCbQuery(PRIVATE_ADMIN_TEXT);
  const data = ctx.callbackQuery.data;
  const p = data.split(':');
  if (data.startsWith('adm:rp:')) return handleResetPasswordCallback(ctx, s);
  if (s.flow === 'resetPassword') return ctx.answerCbQuery(ACTIVE_FLOW_TEXT);
  if (data.startsWith('adm:cu:')) return handleCreateUserCallback(ctx, s);
  if (s.flow === 'createUser' && s.step === 'saving') return ctx.answerCbQuery('So‘rov bajarilmoqda. Iltimos, kuting.');

  // --- Foydalanuvchilar ro'yxati ---
  if (data === 'adm:menu') {
    await ctx.answerCbQuery();
    if (s.flow === 'createUser') return cancelCreateUser(ctx, s);
    session.reset(s);
    return ctx.reply('🛡 Admin paneli. Menyudan tanlang:', keyboards.adminMenu());
  }
  if (data === 'adm:noop') return ctx.answerCbQuery();
  if (p[0] === 'adm' && p[1] === 'approve' && s.admin) {
    const user = s.admin.users.find((u) => String(u.id) === p[2]);
    if (!user) return ctx.answerCbQuery('Foydalanuvchi topilmadi', true);
    await api.put(`/admin/users/${user.id}`, { approved: true }, { token: s.token });
    await fetchUsers(s);
    await ctx.answerCbQuery('Hisob tasdiqlandi');
    return editUserList(ctx, s);
  }
  if (p[0] === 'adm' && p[1] === 'filter' && s.admin) {
    await ctx.answerCbQuery();
    s.admin.role = p[2] || '';
    s.admin.page = 0;
    await fetchUsers(s);
    return editUserList(ctx, s);
  }
  if (p[0] === 'adm' && p[1] === 'page' && s.admin) {
    await ctx.answerCbQuery();
    if (p[2] === 'noop') return;
    s.admin.page = Number(p[2]);
    return editUserList(ctx, s);
  }
  if (p[0] === 'adm' && p[1] === 'promote' && p[2] === 'ok' && s.admin) {
    await ctx.answerCbQuery();
    return promoteUser(ctx, s, p[3]);
  }
  if (p[0] === 'adm' && p[1] === 'promote' && p[2] === 'no' && s.admin) {
    await ctx.answerCbQuery();
    return editUserList(ctx, s);
  }
  if (p[0] === 'adm' && p[1] === 'promote' && s.admin) {
    return showUserDetails(ctx, s, p[2]);
  }

  // --- Dars biriktirish wizard ---
  if (s.flow !== 'assign') return ctx.answerCbQuery();

  if (p[0] === 'adm' && p[1] === 'asg' && p[2] === 'cancel') {
    await ctx.answerCbQuery('Bekor qilindi');
    session.reset(s);
    return ctx.reply('🛡 Admin paneli. Menyudan tanlang:', keyboards.adminMenu());
  }
  if (p[2] === 't' && s.step === 'teacher') {
    const teacher = s.data.teachers.find((t) => String(t.id) === p[3]);
    if (!teacher) return ctx.answerCbQuery('O‘qituvchi topilmadi', true);
    await ctx.answerCbQuery();
    s.data.teacherId = teacher.id;
    s.data.teacherName = teacher.fullName;
    s.step = 'subject';
    s.data.subjects = await api.get('/admin/subjects', { token: s.token });
    const kb = Markup.inlineKeyboard(s.data.subjects.map((sub) => [Markup.button.callback(`📚 ${sub.name}`, `adm:asg:s:${sub.id}`)]));
    return ctx.editMessageText('2️⃣ Fanni tanlang:', kb);
  }
  if (p[2] === 's' && s.step === 'subject') {
    const subject = s.data.subjects.find((sub) => String(sub.id) === p[3]);
    if (!subject) return ctx.answerCbQuery('Fan topilmadi', true);
    await ctx.answerCbQuery();
    s.data.subjectId = subject.id;
    s.data.subjectName = subject.name;
    s.step = 'groups';
    s.data.allGroups = await api.get('/admin/groups', { token: s.token });
    const r = renderGroupPicker(s);
    return ctx.editMessageText(r.text, r.extra);
  }
  if (p[2] === 'g' && s.step === 'groups') {
    await ctx.answerCbQuery();
    const gid = p[3];
    const idx = s.data.groups.indexOf(gid);
    const g = s.data.allGroups.find((x) => String(x.id) === String(gid));
    if (idx >= 0) {
      s.data.groups.splice(idx, 1);
      delete s.data.groupNames[gid];
    } else {
      s.data.groups.push(gid);
      if (g) s.data.groupNames[gid] = g.name;
    }
    const r = renderGroupPicker(s);
    return ctx.editMessageText(r.text, r.extra);
  }
  if (p[2] === 'gdone' && s.step === 'groups') {
    if (!s.data.groups.length) return ctx.answerCbQuery('Kamida bitta guruh tanlang!', true);
    await ctx.answerCbQuery();
    s.data.groupNamesList = s.data.groups.map((id) => s.data.groupNames[id] || id);
    s.step = 'date';
    return ctx.editMessageText(`4️⃣ Dars sanasini kiriting (YYYY-MM-DD, ertadan boshlab — ${utils.addDays(utils.todayISO(), 1)} yoki keyin):`);
  }
  if (p[2] === 'p' && s.step === 'pair') {
    const slot = (s.data.slots || []).find((x) => x.pairNumber === Number(p[3]));
    if (!slot) return ctx.answerCbQuery('Bu vaqt endi bo‘sh emas. Sanani qayta tanlang.', true);
    await ctx.answerCbQuery();
    s.data.pairNumber = slot.pairNumber;
    s.data.startTime = slot.startTime;
    s.data.endTime = slot.endTime;
    s.step = 'room';
    return ctx.editMessageText("6️⃣ Xona va binoni kiriting (masalan: 306-4-o'quv bino):");
  }
  if (p[2] === 'ty' && s.step === 'type') {
    await ctx.answerCbQuery();
    s.data.type = p[3];
    s.step = 'confirm';
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Biriktirish', 'adm:asg:ok')],
      [Markup.button.callback('❌ Bekor qilish', 'adm:asg:cancel')],
    ]);
    return ctx.editMessageText(assignSummary(s), kb);
  }
  if (p[2] === 'ok' && s.step === 'confirm') {
    await ctx.answerCbQuery();
    return finishAssign(ctx, s);
  }
  return ctx.answerCbQuery();
}

module.exports = { handleText, handleCallback, handleAssignText, handleCreateUserText, handleResetPasswordText };
