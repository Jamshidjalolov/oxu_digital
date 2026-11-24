// Statik klaviaturalar
const { Markup } = require('telegraf');

function welcomeKB() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔐 Kirish', 'auth:login')],
  ]);
}

function createUserRoleKB() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎓 Talaba', 'adm:cu:role:student'), Markup.button.callback("👨‍🏫 O'qituvchi", 'adm:cu:role:teacher')],
    [Markup.button.callback('🛡 Admin', 'adm:cu:role:admin')],
    [Markup.button.callback('❌ Bekor qilish', 'adm:cu:cancel')],
  ]);
}

function adminMenu() {
  return Markup.keyboard([
    ['➕ Hisob yaratish'],
    ['🎓 Rol berish', '📚 Dars biriktirish'],
    ['👥 Foydalanuvchilar', '📊 Hisobot'],
    ['🔔 Bildirishnomalar', '🚪 Chiqish'],
  ]).resize();
}

function teacherMenu() {
  return Markup.keyboard([
    ['📚 Mening darslarim', '🗓 Haftalik jadval'],
    ['📊 Statistika'],
    ['🔔 Bildirishnomalar', '🚪 Chiqish'],
  ]).resize();
}

function studentMenu() {
  return Markup.keyboard([
    ['🗓 Haftalik jadval', '📊 Mening davomatim'],
    ['🔔 Bildirishnomalar', '🚪 Chiqish'],
  ]).resize();
}

function pairNumbersKB(prefix) {
  return Markup.inlineKeyboard([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [
    Markup.button.callback(String(n), `${prefix}:${n}`),
  ]));
}

function lessonTypeKB(prefix) {
  return Markup.inlineKeyboard([
    ["📖 Ma'ruza", '✍️ Amaliyot', '🧪 Laboratoriya'].map((t) => Markup.button.callback(t, `${prefix}:${t.replace(/^\S+\s/, '')}`)),
  ]);
}

module.exports = {
  welcomeKB, createUserRoleKB, adminMenu, teacherMenu, studentMenu,
  pairNumbersKB, lessonTypeKB,
};
