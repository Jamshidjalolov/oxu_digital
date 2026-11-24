// Yordamchi funksiyalar: sana/vaqt, validatsiya, xatoliklar
const { Markup } = require('telegraf');

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayISO() {
  return toISO(new Date());
}

// Joriy haftaning dushanbasi (YYYY-MM-DD)
function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// "2026-11-09" -> "9 noyabr, dushanba"
function humanDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
}

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toISO(d) === s;
}

function isValidTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function normalizePhone(value) {
  return typeof value === 'string' ? value.replace(/[\s()+-]/g, '').replace(/^998(?=\d{9}$)/, '') : '';
}
function isValidPhone(s) {
  return /^\d{9}$/.test(normalizePhone(s));
}

// API xatolaridan foydalanuvchiga tushunarli xabar
function errText(err) {
  return (err && err.response && err.response.data && err.response.data.message) ||
    (err && err.message) ||
    "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.";
}

async function handleError(ctx, s, err) {
  try {
    if (err && err.response && err.response.status === 401) {
      s.token = null;
      s.user = null;
      s.flow = null;
      s.step = null;
      s.data = {};
      await ctx.reply("Sessiya muddati tugagan. Qayta kirish uchun /start buyrug'ini bosing.");
      return;
    }
    await ctx.reply(`⚠️ ${errText(err)}`);
  } catch (_) {
    // ignore
  }
}

// Sahifalash tugmalari: ◀ 2/5 ▶
function pagerRow(prefix, page, totalPages) {
  const row = [];
  if (page > 0) row.push(Markup.button.callback('◀', `${prefix}:${page - 1}`));
  row.push(Markup.button.callback(`${page + 1}/${totalPages}`, `${prefix}:noop`));
  if (page < totalPages - 1) row.push(Markup.button.callback('▶', `${prefix}:${page + 1}`));
  return row;
}

module.exports = {
  toISO, todayISO, mondayOf, addDays, humanDate, shortDate,
  isValidDate, isValidTime, isValidPhone, normalizePhone,
  errText, handleError, pagerRow,
};
