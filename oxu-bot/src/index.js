// OXU Digital — Telegram bot (telegraf v4)
require('dotenv').config();
const { Telegraf } = require('telegraf');

const session = require('./session');
const auth = require('./scenes/auth');
const admin = require('./scenes/admin');
const teacher = require('./scenes/teacher');
const notifications = require('./scenes/notifications');
const utils = require('./utils');

if (!process.env.BOT_TOKEN) {
  console.error('XATO: BOT_TOKEN topilmadi. .env faylini .env.example asosida yarating.');
  process.exit(1);
}
if (!process.env.BOT_LINK_SECRET) console.error(auth.LINK_CONFIG_TEXT);

const bot = new Telegraf(process.env.BOT_TOKEN);

// /start — kirgan bo'lsa roli bo'yicha menyu, aks holda kutib olish
bot.start(async (ctx) => {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(auth.PRIVATE_ONLY_TEXT);
  const s = session.get(ctx.chat.id);
  if (s.token && s.user) return auth.showRoleMenu(ctx, s);
  await ctx.reply(auth.WELCOME_TEXT, auth.welcomeKeyboard());
});

// Inline tugmalar
bot.on('callback_query', async (ctx) => {
  if (!ctx.chat || ctx.chat.type !== 'private') {
    return ctx.answerCbQuery(auth.PRIVATE_ONLY_TEXT, { show_alert: true });
  }
  const s = session.get(ctx.chat.id);
  const data = ctx.callbackQuery.data || '';
  try {
    if (s.flow === 'resetPassword' && !data.startsWith('adm:rp:')) {
      return ctx.answerCbQuery('Avval parolni yangilashni tugating yoki bekor qiling.');
    }
    if (data.startsWith('auth:')) return auth.handleCallback(ctx, s);
    if (data.startsWith('ntf:')) return notifications.handleCallback(ctx, s);
    if (s.token && s.user && s.user.role === 'admin' && data.startsWith('adm:')) return admin.handleCallback(ctx, s);
    if (s.token && s.user && (s.user.role === 'teacher' || s.user.role === 'admin') && (data.startsWith('tch:') || data.startsWith('att:'))) {
      return teacher.handleCallback(ctx, s);
    }
    return ctx.answerCbQuery();
  } catch (err) {
    try { await ctx.answerCbQuery(); } catch (_) { /* ignore */ }
    return utils.handleError(ctx, s, err);
  }
});

// Matnli xabarlar
bot.on('text', async (ctx) => {
  if (!ctx.chat || ctx.chat.type !== 'private') return ctx.reply(auth.PRIVATE_ONLY_TEXT);
  const s = session.get(ctx.chat.id);
  const text = (ctx.message.text || '').trim();
  try {
    // Faol oqimlar (state machine)
    if (s.flow === 'login') return auth.handleLoginText(ctx, s, text);
    if (s.flow === 'createUser' && s.token && s.user && s.user.role === 'admin') {
      return admin.handleCreateUserText(ctx, s, ctx.message.text || '');
    }
    if (s.flow === 'resetPassword') return admin.handleResetPasswordText(ctx, s, ctx.message.text || '');
    if (s.flow === 'assign' && s.user && s.user.role === 'admin') return admin.handleAssignText(ctx, s, text);

    if (text.includes('Chiqish')) return auth.logout(ctx, s);

    if (!s.token || !s.user) {
      return ctx.reply("Avval tizimga kiring. /start buyrug'ini bosing.", auth.welcomeKeyboard());
    }

    if (text.includes('Bildirishnomalar')) return notifications.show(ctx, s);
    if (s.user.role === 'admin') return admin.handleText(ctx, s, text);
    if (s.user.role === 'teacher') return teacher.handleText(ctx, s, text);
    return auth.handleStudentText(ctx, s, text);
  } catch (err) {
    return utils.handleError(ctx, s, err);
  }
});

// Kutilmagan xatolar
bot.catch(async (err, ctx) => {
  console.error('Bot xatosi. Kod:', err.response?.error_code || err.code || 'unknown');
  try {
    const s = session.get(ctx.chat.id);
    await utils.handleError(ctx, s, err);
  } catch (_) {
    // ignore
  }
});

bot.launch({}, () => {
  console.log('OXU Digital: Telegram ulanishi tasdiqlandi.');
}).catch((err) => {
  console.error('Botni ishga tushirib bo‘lmadi. Xato kodi:', err.code || 'unknown');
  process.exitCode = 1;
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
