const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./api');
const admin = require('./scenes/admin');
const session = require('./session');
const utils = require('./utils');

const FUTURE = utils.addDays(utils.todayISO(), 2);

const USERS = [
  { id: '000000000000000000000001', fullName: '<b>Student</b>', phone: '901234567', role: 'student', approved: false },
  { id: '000000000000000000000002', fullName: 'Teacher', phone: '909876543', role: 'teacher', approved: true },
  { id: '000000000000000000000003', fullName: 'Admin', phone: '901112233', role: 'admin', approved: true },
];
const PASSWORD = '  <b>new&pass</b>  ';
const state = () => ({ token: 'test-admin-token', user: { id: 'admin-id', role: 'admin' }, flow: null, step: null, data: {}, admin: null });
const context = (data = '') => ({
  chat: { id: 12345, type: 'private' }, from: { id: 12345, is_bot: false }, callbackQuery: { data },
  replies: [], edits: [], answers: [],
  async reply(text, extra) { this.replies.push({ text, extra }); },
  async editMessageText(text, extra) { this.edits.push({ text, extra }); },
  async answerCbQuery(text) { this.answers.push(text); },
});

function mockApi(t) {
  return {
    get: t.mock.method(api, 'get', async (path) => {
      if (path === '/admin/users') return USERS.map((u) => ({ ...u }));
      if (path === '/admin/groups') return [{ id: 'group-id', name: 'Group 1' }];
      if (path === '/admin/subjects') return [{ id: 'subject-id', name: 'Math' }];
      if (path === '/admin/lesson-slots') return { date: FUTURE, slots: [{ pairNumber: 2, startTime: '10:00', endTime: '11:20' }, { pairNumber: 3, startTime: '11:30', endTime: '12:50' }] };
      assert.fail(`Unexpected GET ${path}`);
    }),
    post: t.mock.method(api, 'post', async () => ({ password: 'not-the-entered-password' })),
    put: t.mock.method(api, 'put', async () => ({ password: 'not-the-entered-password' })),
    del: t.mock.method(api, 'del', async () => assert.fail('Unexpected DELETE')),
  };
}

function buttons(message) {
  return message.extra?.reply_markup?.inline_keyboard?.flat() || [];
}
function callback(message, prefix) {
  const button = buttons(message).find((b) => b.callback_data.startsWith(prefix));
  assert.ok(button, `Missing callback ${prefix}`);
  return button.callback_data;
}
async function click(ctx, s, data) {
  ctx.callbackQuery.data = data;
  return admin.handleCallback(ctx, s);
}
async function browse(ctx, s) {
  await admin.handleText(ctx, s, 'Foydalanuvchilar');
  return ctx.replies.at(-1);
}
async function beginReset(ctx, s, user = USERS[0]) {
  const list = await browse(ctx, s);
  const start = buttons(list).find((b) => b.callback_data.startsWith('adm:rp:start:') && b.callback_data.endsWith(`:${user.id}`)).callback_data;
  await click(ctx, s, start);
  return { start, cancel: callback(ctx.replies.at(-1), 'adm:rp:cancel:') };
}
async function enterReset(ctx, s, password = PASSWORD) {
  await admin.handleResetPasswordText(ctx, s, password);
  assert.equal(s.step, 'confirm');
  return callback(ctx.replies.at(-1), 'adm:rp:ok:');
}
async function prepareCreate(ctx, s, role = 'teacher', password = PASSWORD) {
  await admin.handleText(ctx, s, 'Hisob yaratish');
  for (const text of ['New Account', '901234567', password]) await admin.handleCreateUserText(ctx, s, text);
  await click(ctx, s, `adm:cu:role:${role}`);
  if (role === 'student') await click(ctx, s, 'adm:cu:group:0');
  assert.equal(s.step, 'confirm');
}
function assertCleared(s, oldData) {
  assert.equal(s.flow, null);
  assert.equal(s.step, null);
  assert.equal(s.admin, null);
  assert.deepEqual(s.data, {});
  assert.equal(oldData.password, undefined);
}
function assertCredentials(message, phone, password) {
  assert.ok(message.text.includes(`Login (telefon): ${phone}`));
  assert.ok(message.text.includes(`Parol: ${password}\n`));
  assert.ok(message.text.includes('shaxsiy Telegram chatida qoladi'));
  assert.equal(message.extra.protect_content, true);
  assert.equal(message.extra.parse_mode, undefined);
  assert.equal(message.extra.entities, undefined);
}
function assertNoMutation(mocks) {
  assert.equal(mocks.post.mock.callCount(), 0);
  assert.equal(mocks.put.mock.callCount(), 0);
  assert.equal(mocks.del.mock.callCount(), 0);
}

test('credential actions reject unauthenticated, nonadmin, and nonprivate chats', async (t) => {
  const mocks = mockApi(t);
  for (const scenario of ['anonymous', 'student', 'teacher', 'group', 'supergroup', 'channel', 'missing-chat']) {
    const ctx = context();
    const s = state();
    if (scenario === 'anonymous') s.token = null;
    else if (['student', 'teacher'].includes(scenario)) s.user.role = scenario;
    else if (scenario === 'missing-chat') delete ctx.chat;
    else ctx.chat.type = scenario;
    await admin.handleText(ctx, s, 'Hisob yaratish');
    await admin.handleText(ctx, s, 'Foydalanuvchilar');
    assert.equal(s.flow, null);
    s.flow = 'createUser'; s.step = 'password';
    await admin.handleCreateUserText(ctx, s, PASSWORD);
    assert.equal(s.data.password, undefined);
    s.step = 'confirm'; s.data.password = PASSWORD;
    await click(ctx, s, 'adm:cu:ok');
    s.flow = 'resetPassword'; s.step = 'enter'; s.data = { requestId: 'trusted' };
    await admin.handleResetPasswordText(ctx, s, PASSWORD);
    assert.equal(s.data.password, undefined);
    s.step = 'confirm'; s.data.password = PASSWORD;
    await click(ctx, s, 'adm:rp:ok:trusted');
    assert.ok(ctx.replies.every((r) => !r.text.includes(PASSWORD)));
  }
  assert.equal(mocks.get.mock.callCount(), 0);
  assertNoMutation(mocks);
});

test('browse labels phone as login and adds short ID-only student/teacher reset buttons', async (t) => {
  mockApi(t);
  const ctx = context(); const s = state();
  const message = await browse(ctx, s);
  assert.ok(message.text.includes(`Login (telefon): ${USERS[0].phone}`));
  const reset = buttons(message).filter((b) => b.callback_data.startsWith('adm:rp:'));
  assert.equal(reset.length, 2);
  assert.ok(reset.every((b) => b.text.includes('Parolni yangilash')));
  for (const b of reset) {
    assert.ok(Buffer.byteLength(b.callback_data) <= 64);
    assert.match(b.callback_data, /^adm:rp:start:[a-f0-9]{12}:[a-f0-9]{24}$/);
    assert.ok(!b.callback_data.includes(USERS[0].phone));
  }
  assert.equal(message.extra.parse_mode, undefined);
  session.reset(s);
  await admin.handleText(ctx, s, 'Rol berish');
  assert.ok(!buttons(ctx.replies.at(-1)).some((b) => b.callback_data.startsWith('adm:rp:')));
  assert.ok(buttons(ctx.replies.at(-1)).some((b) => b.callback_data.startsWith('adm:promote:')));
});

test('replacement requires explicit confirmation and sends only the entered password', async (t) => {
  const mocks = mockApi(t);
  for (const user of USERS.slice(0, 2)) {
    const ctx = context(); const s = state();
    await beginReset(ctx, s, user);
    assert.equal(s.flow, 'resetPassword');
    assert.equal(s.step, 'enter');
    assert.ok(ctx.replies.at(-1).text.includes(user.fullName));
    assert.ok(ctx.replies.at(-1).text.includes('tasdiqlash va saqlashdan keyin'));
    const ok = await enterReset(ctx, s);
    const oldData = s.data;
    const before = mocks.put.mock.callCount();
    assert.ok(!ctx.replies.some((r) => r.text.includes(PASSWORD)));
    await admin.handleResetPasswordText(ctx, s, 'Tasdiqlash va saqlash');
    assert.equal(mocks.put.mock.callCount(), before);
    assert.equal(s.data.password, PASSWORD);
    await click(ctx, s, ok);
    assert.equal(mocks.put.mock.callCount(), before + 1);
    assert.deepEqual(mocks.put.mock.calls.at(-1).arguments, [`/admin/users/${user.id}`, { password: PASSWORD }, { token: 'test-admin-token' }]);
    assertCredentials(ctx.replies.at(-1), user.phone, PASSWORD);
    assertCleared(s, oldData);
    await click(ctx, s, ok);
    assert.equal(mocks.put.mock.callCount(), before + 1);
  }
  assert.equal(mocks.post.mock.callCount(), 0);
});

test('password validation counts characters and UTF-8 bytes, preserving whitespace', async (t) => {
  const mocks = mockApi(t);
  const ctx = context(); const s = state();
  await beginReset(ctx, s);
  for (const invalid of ['abcde', 'a'.repeat(73), 'я'.repeat(37), '𐐀'.repeat(5)]) {
    await admin.handleResetPasswordText(ctx, s, invalid);
    assert.equal(s.step, 'enter');
    assert.equal(s.data.password, undefined);
  }
  for (const valid of ['abcdef', 'я'.repeat(36), '𐐀'.repeat(18), PASSWORD]) {
    await enterReset(ctx, s, valid);
    assert.equal(s.data.password, valid);
    await admin.handleResetPasswordText(ctx, s, 'Bekor qilish');
    await beginReset(ctx, s);
  }
  assertNoMutation(mocks);
});

test('cancellation at entry or confirmation clears secrets without changing any password', async (t) => {
  const mocks = mockApi(t);
  for (const confirm of [false, true]) {
    for (const byText of [false, true]) {
      const ctx = context(); const s = state();
      const { cancel } = await beginReset(ctx, s);
      const ok = confirm ? await enterReset(ctx, s) : `adm:rp:ok:${s.data.requestId}`;
      const oldData = s.data;
      if (byText) await admin.handleResetPasswordText(ctx, s, ' Bekor qilish ');
      else await click(ctx, s, cancel);
      assertCleared(s, oldData);
      await click(ctx, s, ok);
      assert.ok(!ctx.replies.some((r) => r.text.includes(PASSWORD)));
    }
  }
  assertNoMutation(mocks);
});

test('stale, forged, mismatched, and out-of-order reset callbacks do not mutate users', async (t) => {
  const mocks = mockApi(t);
  const ctx = context(); const s = state();
  const first = await browse(ctx, s);
  const oldStart = callback(first, 'adm:rp:start:');
  await browse(ctx, s);
  for (const data of [oldStart, `adm:rp:start:${s.admin.resetId}:${USERS[2].id}`, `adm:rp:start:${s.admin.resetId}:../../users`, 'adm:rp:ok:unknown']) {
    await click(ctx, s, data);
    assert.equal(s.flow, null);
  }
  const { cancel } = await beginReset(ctx, s);
  const prematureOk = `adm:rp:ok:${s.data.requestId}`;
  await click(ctx, s, prematureOk);
  assert.equal(s.step, 'enter');
  const oldOk = await enterReset(ctx, s);
  await click(ctx, s, cancel);
  await beginReset(ctx, s);
  await enterReset(ctx, s, 'second-password');
  for (const data of [oldOk, cancel, 'adm:rp:ok:unknown', `adm:rp:ok:${s.data.requestId}:extra`]) await click(ctx, s, data);
  assert.equal(s.step, 'confirm');
  assert.equal(s.data.password, 'second-password');
  assertNoMutation(mocks);
});

test('reset cannot override active flows and existing callbacks cannot interrupt reset', async (t) => {
  const mocks = mockApi(t);
  for (const flow of ['createUser', 'assign', 'login', 'attendance']) {
    const ctx = context(); const s = state();
    const list = await browse(ctx, s);
    s.flow = flow; s.step = 'existing'; s.data = { password: 'retained' };
    await click(ctx, s, callback(list, 'adm:rp:start:'));
    await admin.handleText(ctx, s, 'Hisob yaratish');
    assert.equal(s.flow, flow);
    assert.deepEqual(s.data, { password: 'retained' });
  }
  const ctx = context(); const s = state();
  const { start } = await beginReset(ctx, s);
  await enterReset(ctx, s);
  const data = s.data;
  for (const value of [start, 'adm:menu', 'adm:cu:ok', 'adm:asg:cancel', `adm:approve:${USERS[0].id}`, 'adm:filter:teacher']) {
    await click(ctx, s, value);
    assert.equal(s.data, data);
    assert.equal(s.step, 'confirm');
  }
  assertNoMutation(mocks);
});

test('saving blocks duplicate saves and cancellation while one PUT is in flight', async (t) => {
  const mocks = mockApi(t);
  let finish;
  mocks.put.mock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const ctx = context(); const s = state();
  const { cancel } = await beginReset(ctx, s);
  const ok = await enterReset(ctx, s);
  const pending = click(ctx, s, ok);
  assert.equal(s.step, 'saving');
  await click(ctx, s, ok);
  await click(ctx, s, cancel);
  await admin.handleResetPasswordText(ctx, s, 'Bekor qilish');
  assert.equal(s.step, 'saving');
  assert.equal(mocks.put.mock.callCount(), 1);
  finish();
  await pending;
  assert.equal(s.flow, null);
});

test('API failures redact raw, JSON-escaped and URI-encoded passwords and clear both flows', async (t) => {
  const mocks = mockApi(t);
  const secret = '  quotes"\\\n<&>  ';
  const forms = [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)];
  const fail = async () => { throw { response: { status: 400, data: { message: forms.join(' | ') } } }; };
  mocks.put.mock.mockImplementation(fail);
  mocks.post.mock.mockImplementation(fail);
  for (const flow of ['createUser', 'resetPassword']) {
    const ctx = context(); const s = state();
    let ok = 'adm:cu:ok';
    if (flow === 'createUser') await prepareCreate(ctx, s, 'teacher', secret);
    else { await beginReset(ctx, s); ok = await enterReset(ctx, s, secret); }
    const data = s.data;
    await click(ctx, s, ok);
    assertCleared(s, data);
    assert.ok(ctx.replies.at(-1).text.includes('[yashirilgan]'));
    for (const form of forms) assert.ok(ctx.replies.every((r) => !r.text.includes(form)));
    assert.ok(!JSON.stringify(s).includes(secret));
  }
});

test('401 errors clear credentials and authentication without returning the API message', async (t) => {
  const mocks = mockApi(t);
  const fail = async () => { throw { response: { status: 401, data: { message: PASSWORD } } }; };
  mocks.put.mock.mockImplementation(fail);
  mocks.post.mock.mockImplementation(fail);
  for (const flow of ['createUser', 'resetPassword']) {
    const ctx = context(); const s = state();
    let ok = 'adm:cu:ok';
    if (flow === 'createUser') await prepareCreate(ctx, s);
    else { await beginReset(ctx, s); ok = await enterReset(ctx, s); }
    const data = s.data;
    await click(ctx, s, ok);
    assertCleared(s, data);
    assert.equal(s.token, null);
    assert.equal(s.user, null);
    assert.ok(!ctx.replies.at(-1).text.includes(PASSWORD));
  }
});

test('new student, teacher and admin creation still works and shows only entered credentials', async (t) => {
  const mocks = mockApi(t);
  for (const role of ['student', 'teacher', 'admin']) {
    const ctx = context(); const s = state();
    await prepareCreate(ctx, s, role);
    assert.ok(!ctx.replies.some((r) => r.text.includes(PASSWORD)));
    const data = s.data;
    await click(ctx, s, 'adm:cu:ok');
    const body = { fullName: 'New Account', phone: '901234567', password: PASSWORD, role };
    if (role === 'student') body.groupId = 'group-id';
    assert.deepEqual(mocks.post.mock.calls.at(-1).arguments, ['/admin/users', body, { token: 'test-admin-token' }]);
    assertCredentials(ctx.replies.at(-1), body.phone, PASSWORD);
    assert.ok(!ctx.replies.at(-1).text.includes('not-the-entered-password'));
    assertCleared(s, data);
  }
});

test('create cancellation clears the entered password with no API mutation', async (t) => {
  const mocks = mockApi(t);
  const ctx = context(); const s = state();
  await prepareCreate(ctx, s);
  const data = s.data;
  await click(ctx, s, 'adm:cu:cancel');
  assertCleared(s, data);
  assertNoMutation(mocks);
});

test('credentials are cleared before display and Telegram display failures cannot leak passwords', async (t) => {
  mockApi(t);
  for (const flow of ['createUser', 'resetPassword']) {
    const ctx = context(); const s = state();
    let ok = 'adm:cu:ok';
    if (flow === 'createUser') await prepareCreate(ctx, s);
    else { await beginReset(ctx, s); ok = await enterReset(ctx, s); }
    const data = s.data;
    const reply = ctx.reply;
    ctx.reply = async function (text, extra) {
      assertCleared(s, data);
      if (extra?.protect_content) throw new Error(`Telegram rejected ${PASSWORD}`);
      return reply.call(this, text, extra);
    };
    await click(ctx, s, ok);
    assert.ok(ctx.replies.at(-1).text.includes('Amal bajarildi'));
    assert.ok(ctx.replies.every((r) => !r.text.includes(PASSWORD)));
  }
});

test('administrator is rechecked before API submission and after response', async (t) => {
  const mocks = mockApi(t);
  for (const flow of ['createUser', 'resetPassword']) {
    const ctx = context(); const s = state();
    let ok = 'adm:cu:ok';
    if (flow === 'createUser') await prepareCreate(ctx, s);
    else { await beginReset(ctx, s); ok = await enterReset(ctx, s); }
    const data = s.data;
    ctx.answerCbQuery = async () => { s.user.role = 'teacher'; };
    await click(ctx, s, ok);
    assertCleared(s, data);
  }
  assertNoMutation(mocks);
  for (const flow of ['createUser', 'resetPassword']) {
    const ctx = context(); const s = state();
    let ok = 'adm:cu:ok';
    if (flow === 'createUser') await prepareCreate(ctx, s);
    else { await beginReset(ctx, s); ok = await enterReset(ctx, s); }
    const data = s.data;
    const method = flow === 'createUser' ? mocks.post : mocks.put;
    method.mock.mockImplementation(async () => { s.token = 'different-session'; });
    await click(ctx, s, ok);
    assertCleared(s, data);
    assert.ok(!ctx.replies.some((r) => r.text.includes(PASSWORD)));
  }
});

test('existing approve, promote, and assignment flows retain their API payloads', async (t) => {
  const mocks = mockApi(t);
  const ctx = context(); const s = state();
  await browse(ctx, s);
  await click(ctx, s, `adm:approve:${USERS[0].id}`);
  assert.deepEqual(mocks.put.mock.calls.at(-1).arguments[1], { approved: true });
  await admin.handleText(ctx, s, 'Rol berish');
  await click(ctx, s, `adm:promote:${USERS[0].id}`);
  await click(ctx, s, `adm:promote:ok:${USERS[0].id}`);
  assert.deepEqual(mocks.put.mock.calls.at(-1).arguments[1], { fullName: USERS[0].fullName, phone: USERS[0].phone, role: 'teacher', approved: true });
  await admin.handleText(ctx, s, 'Dars biriktirish');
  await click(ctx, s, `adm:asg:t:${USERS[1].id}`);
  await click(ctx, s, 'adm:asg:s:subject-id');
  await click(ctx, s, 'adm:asg:g:group-id');
  await click(ctx, s, 'adm:asg:gdone');
  await admin.handleAssignText(ctx, s, utils.todayISO());
  assert.equal(s.step, 'date');
  assert.match(ctx.replies.at(-1).text, /bir kun oldin/);
  assert.equal(s.data.date, undefined);
  assert.equal(mocks.get.mock.calls.filter((call) => call.arguments[0] === '/admin/lesson-slots').length, 0);
  await admin.handleAssignText(ctx, s, FUTURE);
  assert.equal(s.step, 'pair');
  assert.equal(s.data.slots.length, 2);
  await click(ctx, s, 'adm:asg:p:2');
  assert.equal(s.step, 'room');
  await admin.handleAssignText(ctx, s, '306-4');
  await click(ctx, s, 'adm:asg:ty:lecture');
  await click(ctx, s, 'adm:asg:ok');
  assert.deepEqual(mocks.post.mock.calls.at(-1).arguments, ['/admin/lessons', {
    teacherId: USERS[1].id, subjectId: 'subject-id', groupIds: ['group-id'], date: FUTURE,
    startTime: '10:00', endTime: '11:20', pairNumber: 2, room: '306', building: '4', type: 'lecture',
  }, { token: 'test-admin-token' }]);
  assert.equal(s.flow, null);
});
