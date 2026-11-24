const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/push-sw.js'), 'utf8');

function worker(windows = []) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const self = {
    location: { origin: 'https://oxu.example.test' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => {},
    registration: { showNotification: async (title, data) => { shown.push({ title, data }); } },
    clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async (url) => { opened.push(url); } },
  };
  vm.runInNewContext(source, { self, URL });
  const emit = async (name, props) => {
    let work;
    handlers[name]({ ...props, waitUntil: (promise) => { work = promise; } });
    await work;
  };
  return { handlers, shown, opened, emit };
}

test('push displays university branding and a stable notification tag', async () => {
  const w = worker();
  await w.emit('push', { data: { json: () => ({ title: 'Yangi dars', body: 'Fan va vaqt', notificationId: 'test-id', url: '/teacher?week=2026-11-09' }) } });
  assert.equal(w.shown[0].title, 'Yangi dars');
  assert.equal(w.shown[0].data.icon, '/oxu-logo.png');
  assert.equal(w.shown[0].data.tag, 'oxu-test-id');
  assert.equal(w.shown[0].data.data.url, '/teacher?week=2026-11-09');
  assert.equal(w.handlers.fetch, undefined);
});

test('malformed payload still displays a safe default', async () => {
  const w = worker();
  await w.emit('push', { data: { json: () => { throw new Error('invalid JSON'); } } });
  assert.equal(w.shown[0].title, 'OXU Digital');
  assert.equal(w.shown[0].data.data.url, '/');
});

test('notification clicks reject external and obfuscated destinations', async () => {
  for (const url of ['https://evil.example.test', '//evil.example.test', '/\\evil.example.test', '/%5cevil.example.test', '/%0aevil.example.test', 'javascript:alert(1)', null]) {
    const w = worker();
    let closed = false;
    await w.emit('notificationclick', { notification: { close: () => { closed = true; }, data: { url } } });
    assert.equal(closed, true);
    assert.deepEqual(w.opened, ['https://oxu.example.test/']);
  }
});

test('click focuses a matching tab without opening duplicates', async () => {
  let focused = 0;
  const w = worker([{ url: 'https://oxu.example.test/student/attendance', focus: async () => { focused++; } }]);
  await w.emit('notificationclick', { notification: { close() {}, data: { url: '/student/attendance' } } });
  assert.equal(focused, 1);
  assert.equal(w.opened.length, 0);
});

test('click navigates only same-origin tabs', async () => {
  let navigated;
  const w = worker([
    { url: 'https://other.example.test/', navigate: () => assert.fail('Foreign tab must not be navigated') },
    { url: 'https://oxu.example.test/', navigate: async (url) => { navigated = url; return { focus: async () => {} }; } },
  ]);
  await w.emit('notificationclick', { notification: { close() {}, data: { url: '/teacher' } } });
  assert.equal(navigated, 'https://oxu.example.test/teacher');
  assert.equal(w.opened.length, 0);
});
