const { Markup } = require('telegraf');
const api = require('../api');
const auth = require('./auth');

const FLOW_TEXT = '⚠️ Avval faol jarayonni yakunlang yoki bekor qiling.';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,48}$/;

function accessMessage(ctx, s) {
  if (!ctx.chat || ctx.chat.type !== 'private') return auth.PRIVATE_ONLY_TEXT;
  if (!s.token || !s.user) return '🔐 Avval tizimga kiring. /start buyrug‘ini bosing.';
  if (s.flow) return FLOW_TEXT;
  return '';
}

function plainText(value, limit) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

async function show(ctx, s, edit = false) {
  const denied = accessMessage(ctx, s);
  if (denied) return ctx.reply(denied);
  const token = s.token;
  const [inbox, config] = await Promise.all([
    api.get('/notifications', { token }),
    api.get('/notifications/config', { token }),
  ]);
  if (s.token !== token || accessMessage(ctx, s)) return;
  const items = (Array.isArray(inbox.items) ? inbox.items : [])
    .slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 10);
  const count = Number(inbox.unreadCount);
  const unreadCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const telegram = config.telegram || {};
  const enabled = !!(config.preferences && config.preferences.telegram);
  const lines = [
    '🔔 Bildirishnomalar',
    `📬 O‘qilmagan: ${unreadCount}`,
    `📲 Telegram: ${enabled ? 'yoqilgan' : 'o‘chirilgan'}; ${telegram.linked ? 'bog‘langan' : 'bog‘lanmagan'}`,
  ];
  if (!process.env.BOT_LINK_SECRET) lines.push(auth.LINK_CONFIG_TEXT);
  if (!telegram.configured) lines.push('ℹ️ Telegram yetkazish serverda sozlanmagan. Administratorga murojaat qiling.');
  lines.push('', '📥 Eng yangi 10 ta:');
  const rows = [];
  items.forEach((item, i) => {
    const title = plainText(item.title, 70) || 'Bildirishnoma';
    const body = plainText(item.body, 140);
    const url = plainText(item.url, 100);
    const date = plainText(item.createdAt, 16).replace('T', ' ');
    lines.push(`${i + 1}. ${item.readAt ? '✅ O‘qilgan' : '🟢 Yangi'}: ${title}${date ? ` (${date})` : ''}`);
    if (body) lines.push(body);
    if (url) lines.push(url);
    lines.push('');
    const id = String(item._id || '');
    if (!item.readAt && ID_PATTERN.test(id)) {
      rows.push([Markup.button.callback(`✅ ${i + 1}. O‘qildi`, `ntf:read:${id}`)]);
    }
  });
  if (!items.length) lines.push('😴 Bildirishnomalar yo‘q.');
  rows.push([
    Markup.button.callback('🔔 Telegramni yoqish', 'ntf:telegram:on'),
    Markup.button.callback('🔕 Telegramni o‘chirish', 'ntf:telegram:off'),
  ]);
  rows.push([Markup.button.callback('✅ Barchasini o‘qildi', 'ntf:read-all')]);
  rows.push([
    Markup.button.callback('🔄 Yangilash', 'ntf:refresh'),
    Markup.button.callback('⬅️ Orqaga', 'ntf:back'),
  ]);
  // No parse mode: server-provided markup is displayed literally.
  const extra = { ...Markup.inlineKeyboard(rows), link_preview_options: { is_disabled: true } };
  const text = lines.join('\n');
  if (edit) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (err) {
      if (err && err.description && err.description.includes('message is not modified')) return;
    }
  }
  return ctx.reply(text, extra);
}

async function handleCallback(ctx, s) {
  const denied = accessMessage(ctx, s);
  if (denied) return ctx.answerCbQuery(denied, { show_alert: true });
  const data = ctx.callbackQuery.data === 'ntf:open' ? 'ntf:refresh' : ctx.callbackQuery.data || '';
  const match = /^ntf:read:([A-Za-z0-9_-]{1,48})$/.exec(data);
  if (!['ntf:refresh', 'ntf:back', 'ntf:read-all', 'ntf:telegram:on', 'ntf:telegram:off'].includes(data) && !match) {
    return ctx.answerCbQuery();
  }
  await ctx.answerCbQuery();
  if (data === 'ntf:back') return auth.showRoleMenu(ctx, s);
  const token = s.token;
  if (data === 'ntf:telegram:on' || data === 'ntf:telegram:off') {
    const enabled = data === 'ntf:telegram:on';
    if (enabled) {
      const config = await api.get('/notifications/config', { token });
      if (s.token !== token || accessMessage(ctx, s)) return;
      if ((!config.telegram || !config.telegram.linked) && !(await auth.linkTelegram(ctx, s))) return;
    }
    if (s.token !== token || accessMessage(ctx, s)) return;
    await api.put('/notifications/preferences', { telegram: enabled }, { token });
  } else if (data === 'ntf:read-all') {
    await api.put('/notifications/read-all', {}, { token });
  } else if (match) {
    await api.put(`/notifications/${encodeURIComponent(match[1])}/read`, {}, { token });
  }
  if (s.token !== token || accessMessage(ctx, s)) return;
  return show(ctx, s, true);
}

module.exports = { show, handleCallback };
