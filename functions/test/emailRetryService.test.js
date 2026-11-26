const assert = require("node:assert/strict");
const test = require("node:test");
const { createEmailRetryService } = require("../services/emailRetryService");

test("email retry service coordinates due retries and reports invalid timestamps", async () => {
  const calls = [];
  const logs = [];
  const repository = {
    async listFailedEmailMessages() {
      return [{ id: "retry" }, { id: "bad-time" }, { id: "not-due" }];
    },
    async retryFailedEmailIfDue(message, now) {
      calls.push([message.id, now]);
      if (message.id === "retry") return "retried";
      if (message.id === "bad-time") return "invalid_timestamp";
      return "not_due";
    },
  };
  const logger = {
    warn: (...args) => logs.push(["warn", ...args]),
    info: (...args) => logs.push(["info", ...args]),
  };

  const result = await createEmailRetryService(repository, logger)(1234);

  assert.deepEqual(calls, [
    ["retry", 1234],
    ["bad-time", 1234],
    ["not-due", 1234],
  ]);
  assert.deepEqual(result, { retriedCount: 1, invalidTimestampCount: 1 });
  assert.equal(logs.length, 2);
});

test("email retry service surfaces repository failures", async () => {
  const service = createEmailRetryService({
    async listFailedEmailMessages() {
      throw new Error("Firestore unavailable");
    },
  }, { warn() {}, info() {} });

  await assert.rejects(service(), /Firestore unavailable/);
});
