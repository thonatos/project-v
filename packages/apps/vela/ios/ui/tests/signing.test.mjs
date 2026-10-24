import assert from 'node:assert/strict';
import { signingNotice } from '../core/signing.ts';

// A fixed instant keeps the four branches independent of when the test runs.
const NOW = Date.parse('2026-10-25T00:00:00.000Z');

// No embedded profile, or a value the build could not parse.
assert.equal(signingNotice('', NOW), '未读取到签名信息；覆盖安装不会清除设备身份与数据。');
assert.equal(signingNotice('not-a-date', NOW), '未读取到签名信息；覆盖安装不会清除设备身份与数据。');

// Expired at or before now.
assert.equal(signingNotice('2026-10-24T23:59:59.000Z', NOW), '签名已过期，请重新构建并覆盖安装。');
assert.equal(signingNotice('2026-10-25T00:00:00.000Z', NOW), '签名已过期，请重新构建并覆盖安装。');

// Seven days or fewer: the notice counts the remaining days.
assert.equal(signingNotice('2026-10-28T00:00:00.000Z', NOW), '还有 3 天到期，到期前覆盖安装即可。');
assert.equal(signingNotice('2026-11-01T00:00:00.000Z', NOW), '还有 7 天到期，到期前覆盖安装即可。');

// More than seven days: overwriting the app is routine, and the copy must not
// claim a 7-day limit.
const longLived = signingNotice('2027-10-25T00:00:00.000Z', NOW);
assert.equal(longLived, '覆盖安装不会清除设备身份与数据。');
assert.doesNotMatch(longLived, /7\s*天/);

console.log('Vela signing notice cases passed');
