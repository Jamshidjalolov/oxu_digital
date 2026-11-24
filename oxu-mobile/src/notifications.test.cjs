const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { transformFileSync } = require('@babel/core');
const source = transformFileSync(path.join(__dirname, 'notifications.js'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;

function fixture(options = {}) {
  const stored = new Map();
  const calls = [];
  const api = {
    async post(route, body) { calls.push(['post', route, body]); },
    async put(route, body) { calls.push(['put', route, body]); },
    async delete(route, body) { calls.push(['delete', route, body]); },
  };
  const native = {
    AndroidImportance: { HIGH: 4 },
    async setNotificationChannelAsync(id) { calls.push(['channel', id]); },
    async getPermissionsAsync() { return { status: options.permission || 'granted' }; },
    async requestPermissionsAsync() { return { status: options.permission || 'granted' }; },
    async getExpoPushTokenAsync() { return { data: 'ExpoPushToken[isolated-test-token]' }; },
    async dismissAllNotificationsAsync() { calls.push(['dismiss']); },
  };
  const modules = {
    'react-native': { Platform: { OS: options.platform || 'android' } },
    'expo': { isRunningInExpoGo: () => options.nativeExpoGo === true },
    'expo-constants': { appOwnership: options.expoGo ? 'expo' : null, executionEnvironment: options.storeClient ? 'storeClient' : 'standalone', easConfig: options.noProject ? {} : { projectId: 'unit-test-project' } },
    'expo-device': { isDevice: options.device !== false },
    './api': api,
    './storage': { getItem: async (key) => stored.get(key), setItem: async (key, value) => stored.set(key, value), deleteItem: async (key) => stored.delete(key) },
    'expo-notifications': native,
  };
  const exports = {};
  const run = vm.runInThisContext(`(function(require,exports,process){${source}\n})`);
  run((name) => { if (options.disallowNative && name === 'expo-notifications') assert.fail('Expo Go must not load the native push module'); assert.ok(name in modules, name); return modules[name]; }, exports, { env: {} });
  return { helpers: exports, stored, calls, api, native };
}

test('web, emulator, Expo Go and missing project are explicitly unavailable', () => {
  for (const options of [{ platform: 'web' }, { device: false }, { expoGo: true }, { noProject: true }]) {
    assert.ok(fixture(options).helpers.pushUnavailable());
  }
  assert.equal(fixture().helpers.pushUnavailable(), '');
  assert.equal(fixture({ platform: 'web' }).helpers.nativeNotifications(), null);
});

test('registration configures Android channel and authenticated subscription', async () => {
  const f = fixture();
  await f.helpers.registerPush();
  assert.equal(await f.helpers.hasPushToken(), true);
  assert.deepEqual(f.calls.map((call) => call[0]), ['channel', 'post', 'put']);
  assert.equal(f.calls[1][1], '/notifications/subscriptions');
  assert.equal(f.calls[1][2].type, 'expo');
  await f.helpers.disconnectPush();
  assert.equal(await f.helpers.hasPushToken(), false);
  assert.equal(f.calls.at(-2)[0], 'delete');
  assert.equal(f.calls.at(-1)[0], 'dismiss');
});

test('Expo Go never loads native push during startup, registration or logout', async () => {
  for (const mode of [{ expoGo: true }, { storeClient: true }, { nativeExpoGo: true }]) {
    const f = fixture({ ...mode, disallowNative: true });
    assert.equal(f.helpers.nativeNotifications(), null);
    await assert.rejects(f.helpers.registerPush(), /Expo Go/);
    await f.helpers.disconnectPush();
    assert.equal(f.calls.some(call => call[0] === 'post'), false);
  }
});

test('permission denial does not register a destination', async () => {
  const f = fixture({ permission: 'denied' });
  await assert.rejects(f.helpers.registerPush(), /ruxsati berilmadi/);
  assert.equal(await f.helpers.hasPushToken(), false);
  assert.equal(f.calls.some((call) => call[0] === 'post'), false);
});

test('offline unsubscribe preserves the token and fails visibly for safe logout', async () => {
  const f = fixture();
  await f.helpers.registerPush();
  f.api.delete = async () => { throw new Error('offline'); };
  await assert.rejects(f.helpers.disconnectPush(), /offline/);
  assert.equal(await f.helpers.hasPushToken(), true);
});

test('failed setup is rolled back, retaining cleanup identity only if offline', async () => {
  for (const offline of [false, true]) {
    const f = fixture();
    f.api.put = async () => { throw new Error('save failed'); };
    if (offline) f.api.delete = async () => { throw new Error('offline'); };
    await assert.rejects(f.helpers.registerPush(), /save failed/);
    assert.equal(await f.helpers.hasPushToken(), offline);
  }
});

test('logout during token acquisition prevents late registration', async () => {
  const f = fixture();
  let release;
  let tokenRequested;
  const started = new Promise((resolve) => { tokenRequested = resolve; });
  f.native.getExpoPushTokenAsync = () => { tokenRequested(); return new Promise((resolve) => { release = resolve; }); };
  const setup = f.helpers.registerPush();
  await started;
  const logout = f.helpers.disconnectPush();
  release({ data: 'ExpoPushToken[late-test-token]' });
  await Promise.all([setup, logout]);
  assert.equal(await f.helpers.hasPushToken(), false);
  assert.equal(f.calls.some((call) => call[0] === 'post'), false);
});
