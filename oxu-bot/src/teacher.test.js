const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./api');
const teacher = require('./scenes/teacher');

const LESSON = {
  subject: { name: 'Matematika' },
  date: '2026-11-09',
  startTime: '08:30',
  endTime: '09:50',
  pairNumber: 1,
  room: '101',
  groups: [{ name: 'TEST-01' }],
};

const context = (data = '') => ({
  chat: { id: 1, type: 'private' },
  callbackQuery: { data },
  replies: [],
  edits: [],
  answers: [],
  async reply(text, extra) { this.replies.push({ text, extra }); },
  async editMessageText(text, extra) { this.edits.push({ text, extra }); },
  async answerCbQuery(text) { this.answers.push(text); },
});

const buttons = (message) => message.extra?.reply_markup?.inline_keyboard?.flat() || [];
const state = () => ({ token: 'teacher-token', user: { role: 'teacher' }, flow: null, step: null, data: {} });

function attendanceMock(t, locked, allowed = true) {
  return t.mock.method(api, 'get', async (path) => {
    assert.equal(path, '/teacher/lessons/lesson-1/attendance');
    return {
      lesson: LESSON,
      attendanceLocked: locked,
      attendanceAllowed: allowed,
      students: [{ id: 'student-1', fullName: 'Student One', status: locked ? 'present' : null }],
    };
  });
}

test('locked attendance is read-only and cannot be saved again', async (t) => {
  attendanceMock(t, true);
  const put = t.mock.method(api, 'put', async () => assert.fail('Locked attendance must not be saved'));
  const ctx = context('tch:l:lesson-1');
  const s = state();

  await teacher.handleCallback(ctx, s);
  const message = ctx.edits.at(-1);
  assert.match(message.text, /Davomat olingan/);
  const list = buttons(message);
  assert.ok(list.some((button) => button.text === 'Student One ✅'));
  assert.equal(list.some((button) => button.callback_data.startsWith('att:m:')), false);
  assert.equal(list.some((button) => button.callback_data === 'att:save'), false);
  assert.equal(s.data.locked, true);

  for (const data of ['att:save', 'att:m:student-1:absent']) {
    ctx.callbackQuery.data = data;
    await teacher.handleCallback(ctx, s);
    assert.match(ctx.answers.at(-1), /allaqachon olingan/);
  }
  assert.equal(put.mock.callCount(), 0);
});

test('past lessons show a read-only notice and cannot be marked or saved', async (t) => {
  attendanceMock(t, false, false);
  const put = t.mock.method(api, 'put', async () => assert.fail('Past attendance must not be saved'));
  const ctx = context('tch:l:lesson-1');
  const s = state();

  await teacher.handleCallback(ctx, s);
  const message = ctx.edits.at(-1);
  assert.match(message.text, /belgilangan dars vaqtida/);
  const list = buttons(message);
  assert.equal(list.some((button) => button.callback_data.startsWith('att:m:')), false);
  assert.equal(list.some((button) => button.callback_data === 'att:save'), false);
  assert.equal(s.data.past, true);

  for (const data of ['att:save', 'att:m:student-1:present']) {
    ctx.callbackQuery.data = data;
    await teacher.handleCallback(ctx, s);
    assert.match(ctx.answers.at(-1), /belgilangan dars vaqtida/);
  }
  assert.equal(put.mock.callCount(), 0);
});

test('unlocked attendance marks and saves once', async (t) => {
  attendanceMock(t, false);
  const put = t.mock.method(api, 'put', async () => ({ message: 'Davomat saqlandi' }));
  const ctx = context('tch:l:lesson-1');
  const s = state();

  await teacher.handleCallback(ctx, s);
  assert.equal(buttons(ctx.edits.at(-1)).some((button) => button.callback_data === 'att:save'), true);

  ctx.callbackQuery.data = 'att:m:student-1:present';
  await teacher.handleCallback(ctx, s);
  ctx.callbackQuery.data = 'att:save';
  await teacher.handleCallback(ctx, s);

  assert.deepEqual(put.mock.calls.at(-1).arguments, [
    '/teacher/lessons/lesson-1/attendance',
    { records: [{ studentId: 'student-1', status: 'present' }] },
    { token: 'teacher-token' },
  ]);
  assert.equal(s.flow, null);
  assert.match(ctx.replies.at(-1).text, /O‘qituvchi menyusi/);
});

test('a rejected second save returns the teacher to the menu', async (t) => {
  attendanceMock(t, false);
  t.mock.method(api, 'put', async () => {
    throw { response: { status: 409, data: { message: 'Bu dars uchun davomat allaqachon olingan' } } };
  });
  const ctx = context('tch:l:lesson-1');
  const s = state();

  await teacher.handleCallback(ctx, s);
  ctx.callbackQuery.data = 'att:m:student-1:absent';
  await teacher.handleCallback(ctx, s);
  ctx.callbackQuery.data = 'att:save';
  await teacher.handleCallback(ctx, s);

  assert.match(ctx.replies.at(-2).text, /allaqachon olingan/);
  assert.match(ctx.replies.at(-1).text, /O‘qituvchi menyusi/);
  assert.equal(s.flow, null);
});
