const assert = require("node:assert/strict");
const test = require("node:test");
const { getEmailRetryDelayMs, getTimestampMillis } = require("../emailRetry");

test("email retry delay doubles by attempt and caps at one hour", () => {
  assert.equal(getEmailRetryDelayMs(1), 60_000);
  assert.equal(getEmailRetryDelayMs(2), 120_000);
  assert.equal(getEmailRetryDelayMs(3), 240_000);
  assert.equal(getEmailRetryDelayMs(7), 3_600_000);
  assert.equal(getEmailRetryDelayMs(20), 3_600_000);
});

test("email retry delay defaults invalid attempt counts to the first delay", () => {
  assert.equal(getEmailRetryDelayMs(undefined), 60_000);
  assert.equal(getEmailRetryDelayMs("not-a-number"), 60_000);
});

test("timestamp conversion accepts Firestore timestamps, dates, and ISO strings", () => {
  const expected = Date.parse("2026-01-02T03:04:05.000Z");
  assert.equal(getTimestampMillis({ toMillis: () => expected }), expected);
  assert.equal(getTimestampMillis(new Date(expected)), expected);
  assert.equal(getTimestampMillis("2026-01-02T03:04:05.000Z"), expected);
  assert.equal(getTimestampMillis("invalid"), null);
});
