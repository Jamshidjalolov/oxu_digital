// In-memory sessiya saqlash (chatId -> sessiya obyekti)
const sessions = new Map();

function createEmpty() {
  return {
    token: null,
    user: null,
    flow: null, // 'login' | 'createUser' | 'assign' | 'attendance'
    step: null,
    data: {}, // flow uchun vaqtinchalik ma'lumotlar
    admin: null, // admin ro'yxat ko'rinishi holati
    weekStart: null, // o'qituvchi jadvali uchun hafta boshi
  };
}

function get(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, createEmpty());
  return sessions.get(chatId);
}

function destroy(chatId) {
  sessions.delete(chatId);
}

function reset(s) {
  s.flow = null;
  s.step = null;
  s.data = {};
  s.admin = null;
}

module.exports = { get, destroy, reset };
