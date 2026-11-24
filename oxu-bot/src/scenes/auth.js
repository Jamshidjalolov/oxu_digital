// Auth sahnalari: kirish (login), talaba menyusi
const { Markup } = require('telegraf');
const api = require('../api');
const session = require('../session');
const keyboards = require('../keyboards');
const utils = require('../utils');

const WELCOME_TEXT = [
  '👋 Assalomu alaykum!',
  '',
  '🏛 OXU Digital — Osiyo Xalqaro Universiteti davomat tizimi.',
  '',
  '🔐 Tizimga kirish uchun pastdagi «🔐 Kirish» tugmasini bosing.',
  'ℹ️ Hisobni administrator yaratadi.',
].join('\n');
const PHONE_PROMPT = '📱 Telefon raqamingizni yuboring (masalan: 901234567):';

function welcomeKeyboard() {
  return keyboards.welcomeKB();
}

function showRoleMenu(ctx, s) {
  if (s.user.role === 'admin') {
    return ctx.reply('🛡 Admin paneli\n\nKerakli bo‘limni tanlang:', keyboards.adminMenu());
  }
  if (s.user.role === 'teacher') {
    return ctx.reply('👨‍🏫 O‘qituvchi menyusi\n\nDarslar, jadval va davomat shu yerda:', keyboards.teacherMenu());
  }
  return ctx.reply('🎓 Talaba menyusi\n\nJadval va davomatingizni ko‘ring:', keyboards.studentMenu());
}

const PRIVATE_ONLY_TEXT = 'Xavfsizlik uchun botdan faqat shaxsiy chatda foydalaning.';
const LINK_CONFIG_TEXT = 'Telegram bildirishnomalari sozlanmagan: BOT_LINK_SECRET topilmadi. Administratorga murojaat qiling.';

function telegramOptions(s) {
  return { token: s.token, headers: { 'X-Oxu-Bot-Secret': process.env.BOT_LINK_SECRET } };
}

async function linkTelegram(ctx, s) {
  if (!ctx.chat || ctx.chat.type !== 'private' || !ctx.from || ctx.from.is_bot) {
    await ctx.reply(PRIVATE_ONLY_TEXT);
    return false;
  }
  if (!s.token || !s.user) return false;
  if (!process.env.BOT_LINK_SECRET) {
    await ctx.reply(LINK_CONFIG_TEXT);
    return false;
  }
  try {
    await api.put('/auth/telegram', { telegramId: String(ctx.from.id) }, telegramOptions(s));
    return true;
  } catch (_) {
    await ctx.reply('Telegram akkaunti bog‘lanmadi. Kirish saqlanadi; bildirishnomalar menyusida qayta urinib ko‘ring.');
    return false;
  }
}

async function afterAuth(ctx, s) {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(PRIVATE_ONLY_TEXT);
  await linkTelegram(ctx, s);
  await ctx.reply(`🎉 Xush kelibsiz, ${s.user.fullName}!`, { reply_markup: { remove_keyboard: true } });
  return showRoleMenu(ctx, s);
}

async function logout(ctx, s) {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(PRIVATE_ONLY_TEXT);
  let warning = '';
  try {
    if (s.token && s.user) {
      if (!process.env.BOT_LINK_SECRET) warning = LINK_CONFIG_TEXT;
      else await api.put('/auth/telegram', { telegramId: null }, telegramOptions(s));
    }
  } catch (_) {
    warning = 'Telegram bog‘lanishini uzib bo‘lmadi. Yetkazish davom etishi mumkin; qayta kirib Telegramni o‘chiring.';
  } finally {
    session.destroy(ctx.chat.id);
  }
  const text = "👋 Siz tizimdan chiqdingiz.\n\n🔁 Qaytadan kirish uchun /start buyrug'ini bosing.";
  return ctx.reply(warning ? `${text}\n${warning}` : text, Markup.removeKeyboard());
}

// ---------- Kirish (login) ----------

function startLogin(ctx, s) {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(PRIVATE_ONLY_TEXT);
  session.reset(s);
  s.flow = 'login';
  s.step = 'phone';
  return ctx.reply(PHONE_PROMPT, Markup.removeKeyboard());
}

async function handleLoginText(ctx, s, text) {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(PRIVATE_ONLY_TEXT);
  if (s.step === 'phone') {
    if (!utils.isValidPhone(text)) return ctx.reply('⚠️ Noto‘g‘ri format.\n📱 Telefon raqamingizni yuboring (masalan: 901234567):');
    s.data.phone = utils.normalizePhone(text);
    s.step = 'password';
    return ctx.reply('🔑 Parolingizni kiriting:');
  }
  if (s.step === 'password') {
    try {
      const res = await api.post('/auth/login', { phone: s.data.phone, password: text });
      s.token = res.token;
      s.user = res.user;
      session.reset(s);
      return afterAuth(ctx, s);
    } catch (err) {
      if (err && err.response && err.response.status === 401) {
        s.step = 'phone';
        return ctx.reply("⚠️ Login yoki parol noto‘g‘ri.\n📱 Telefon raqamingizni qayta yuboring (masalan: 901234567):");
      }
      throw err;
    }
  }
  session.reset(s);
  return ctx.reply(WELCOME_TEXT, welcomeKeyboard());
}

// ---------- Callback dispatch ----------

async function handleCallback(ctx, s) {
  if (ctx.callbackQuery.data === 'auth:login') {
    await ctx.answerCbQuery();
    return startLogin(ctx, s);
  }
  return ctx.answerCbQuery();
}

// ---------- Talaba menyusi ----------

async function handleStudentText(ctx, s, text) {
  if (text.includes('Haftalik jadval')) {
    const weekStart = utils.mondayOf();
    const res = await api.get('/student/schedule', { token: s.token, params: { weekStart } });
    const dates = res.dates && res.dates.length ? res.dates : Array.from({ length: 6 }, (_, i) => utils.addDays(weekStart, i));
    const lines = ['🗓 Haftalik jadval', ''];
    for (const d of dates) {
      lines.push(`📅 ${utils.humanDate(d)}`);
      const lessons = (res.byDay && res.byDay[d]) || [];
      if (!lessons.length) lines.push('   😴 Dars yo‘q');
      for (const l of lessons) {
        const groups = (l.groups || []).map((g) => g.name).join(', ');
        const mark = l.myStatus === 'present' ? ' ✅' : l.myStatus === 'absent' ? ' ❌' : '';
        lines.push(`   🕐 ${l.pairNumber}-para ${l.startTime}–${l.endTime} · 📚 ${l.subject ? l.subject.name : ''} · 👥 ${groups} · 🚪 ${l.room}-xona${mark}`);
      }
    }
    lines.push('', '💡 ✅ — qatnashgansiz, ❌ — qatnashmagansiz.');
    return ctx.reply(lines.join('\n'));
  }
  if (text.includes('Mening davomatim')) {
    const st = await api.get('/student/attendance', { token: s.token });
    return ctx.reply(
      [
        '📊 Mening davomatim',
        '',
        `📚 Jami darslar: ${st.total}`,
        `✅ Qatnashdim: ${st.present}`,
        `❌ Qatnashmadim: ${st.absent}`,
        `📈 Foiz: ${st.percentage}%`,
      ].join('\n')
    );
  }
  return ctx.reply('ℹ️ Iltimos, menyudagi tugmalardan foydalaning.');
}

module.exports = {
  WELCOME_TEXT,
  PRIVATE_ONLY_TEXT,
  LINK_CONFIG_TEXT,
  welcomeKeyboard,
  showRoleMenu,
  linkTelegram,
  logout,
  startLogin,
  handleLoginText,
  handleCallback,
  handleStudentText,
};
