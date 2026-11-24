const { test } = require('node:test');
const assert = require('node:assert/strict');
const window = require('./utils/attendance-window');
test('Tashkent attendance is open only within the scheduled lesson', () => {
  const lesson = { date: '2026-11-15', startTime: '08:30', endTime: '09:50' };
  for (const [time, expected] of [['2026-11-15T03:29:59Z',false],['2026-11-15T03:30:00Z',true],['2026-11-15T04:49:59Z',true],['2026-11-15T04:50:00Z',false],['2026-11-14T03:30:00Z',false],['2026-11-16T03:30:00Z',false]]) assert.equal(window(lesson, new Date(time)).allowed, expected, time);
});
