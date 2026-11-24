const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./api');
const auth = require('./scenes/auth');
const notifications = require('./scenes/notifications');
const session = require('./session');
const keyboards = require('./keyboards');

process.env.BOT_LINK_SECRET = 'isolated-bot-test-secret';
const state = () => ({ token: 'isolated-test-token', user: { id: 'test-user', role: 'teacher', fullName: 'Test Teacher' }, flow: null, data: {} });
const context = (data = '') => ({
  chat: { id: 123456789, type: 'private' }, from: { id: 123456789, is_bot: false }, callbackQuery: { data },
  replies: [], edits: [], answers: [],
  async reply(text, extra) { this.replies.push({ text, extra }); },
  async editMessageText(text, extra) { this.edits.push({ text, extra }); },
  async answerCbQuery(text) { this.answers.push(text); },
});
const config = { preferences: { telegram: true }, telegram: { linked: true, configured: true } };

function mockInbox(t, items = []) {
  return t.mock.method(api, 'get', async (path, options) => {
    assert.equal(options.token, 'isolated-test-token');
    return path === '/notifications/config' ? config : { items, unreadCount: items.length };
  });
}

test('every role has a notification menu', () => {
  for (const menu of [keyboards.adminMenu(), keyboards.teacherMenu(), keyboards.studentMenu()]) {
    assert.ok(JSON.stringify(menu).includes('Bildirishnomalar'));
  }
});

test('private authenticated idle sessions are required', async (t) => {
  const get = mockInbox(t);
  for (const scenario of ['group', 'anonymous', 'flow']) {
    const ctx = context('ntf:read-all');
    const s = state();
    if (scenario === 'group') ctx.chat.type = 'group';
    if (scenario === 'anonymous') s.token = null;
    if (scenario === 'flow') s.flow = 'assign';
    await notifications.show(ctx, s);
    await notifications.handleCallback(ctx, s);
    assert.equal(ctx.replies.length, 1);
    assert.equal(ctx.answers.length, 1);
    assert.equal(s.flow, scenario === 'flow' ? 'assign' : null);
  }
  assert.equal(get.mock.callCount(), 0);
});

test('inbox stays within Telegram limits and renders untrusted markup literally', async (t) => {
  const items = Array.from({ length: 50 }, (_, i) => ({ _id: i.toString(16).padStart(24, '0'), title: '<b>private</b>'.repeat(30), body: 'long body '.repeat(100), url: '/' + 'x'.repeat(120), createdAt: new Date(2026, 10, 1, 0, i).toISOString() }));
  mockInbox(t, items);
  const ctx = context();
  await notifications.show(ctx, state());
  const { text, extra } = ctx.replies[0];
  assert.ok(text.length < 4096);
  assert.ok(text.includes('<b>private</b>'));
  assert.equal(extra.parse_mode, undefined);
  const callbacks = extra.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.equal(callbacks.filter((value) => value.startsWith('ntf:read:')).length, 10);
  assert.ok(callbacks.every((value) => Buffer.byteLength(value) <= 64));
});

test('read and preference callbacks target only authenticated API routes', async (t) => {
  mockInbox(t);
  const put = t.mock.method(api, 'put', async (_path, _body, options) => { assert.equal(options.token, 'isolated-test-token'); });
  for (const data of ['ntf:read:000000000000000000000001', 'ntf:read-all', 'ntf:telegram:off']) {
    const ctx = context(data);
    await notifications.handleCallback(ctx, state());
    assert.equal(ctx.edits.length, 1);
  }
  assert.deepEqual(put.mock.calls.map((call) => call.arguments[0]), ['/notifications/000000000000000000000001/read', '/notifications/read-all', '/notifications/preferences']);
  assert.deepEqual(put.mock.calls[2].arguments[1], { telegram: false });
  await notifications.handleCallback(context('ntf:read:../../users'), state());
  assert.equal(put.mock.callCount(), 3);
});

test('Telegram enable stops when secure linking fails', async (t) => {
  t.mock.method(api, 'get', async () => ({ ...config, telegram: { linked: false, configured: true } }));
  t.mock.method(auth, 'linkTelegram', async () => false);
  const put = t.mock.method(api, 'put', async () => {});
  await notifications.handleCallback(context('ntf:telegram:on'), state());
  assert.equal(put.mock.callCount(), 0);
});

test('link uses Telegram identity and trusted header, not user text', async (t) => {
  const put = t.mock.method(api, 'put', async (path, body, options) => {
    assert.equal(path, '/auth/telegram');
    assert.deepEqual(body, { telegramId: '123456789' });
    assert.equal(options.headers['X-Oxu-Bot-Secret'], process.env.BOT_LINK_SECRET);
    assert.equal(options.token, 'isolated-test-token');
  });
  assert.equal(await auth.linkTelegram(context(), state()), true);
  const group = context(); group.chat.type = 'group';
  assert.equal(await auth.linkTelegram(group, state()), false);
  assert.equal(put.mock.callCount(), 1);
});

test('logout unlinks before clearing session and reports unlink errors', async (t) => {
  const ctx = context();
  Object.assign(session.get(ctx.chat.id), state());
  const put = t.mock.method(api, 'put', async (path, body, options) => {
    assert.equal(path, '/auth/telegram');
    assert.deepEqual(body, { telegramId: null });
    assert.equal(options.token, 'isolated-test-token');
    assert.ok(session.get(ctx.chat.id).token);
  });
  await auth.logout(ctx, session.get(ctx.chat.id));
  assert.equal(put.mock.callCount(), 1);
  assert.ok(!session.get(ctx.chat.id).token);
  put.mock.mockImplementation(async () => { throw new Error('network'); });
  Object.assign(session.get(ctx.chat.id), state());
  await auth.logout(ctx, session.get(ctx.chat.id));
  assert.ok(ctx.replies.at(-1).text.includes('Yetkazish davom etishi mumkin'));
  assert.ok(!session.get(ctx.chat.id).token);
});
