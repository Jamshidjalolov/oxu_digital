const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidPhone, normalizePhone } = require('./utils');
test('login accepts 50 numbers and Uzbekistan international notation', () => {
  for (const phone of ['502218773', '+998 50 221 87 73', '998502218773', '(50) 221-87-73']) {
    assert.equal(isValidPhone(phone), true);
    assert.equal(normalizePhone(phone), '502218773');
  }
  assert.equal(isValidPhone('901234567'), true);
  for (const phone of ['', null, 502218773, '50221877', '5022187730', '+123502218773', '50abc8773']) assert.equal(isValidPhone(phone), false);
});
