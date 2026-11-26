const assert = require("node:assert/strict");
const test = require("node:test");
const { createEmailRetryRepository } = require("../repositories/emailRetryRepository");

function createTransactionHarness(delivery) {
  const updates = [];
  const emailDocument = { ref: { id: "email-1" } };
  const firestore = {
    async runTransaction(callback) {
      return callback({
        async get() {
          return {
            exists: true,
            get: () => ({ ...delivery }),
          };
        },
        update(reference, changes) {
          updates.push({ reference, changes });
        },
      });
    },
  };
  return { emailDocument, firestore, updates };
}

test("repository re-queues a failed email after its backoff expires", async () => {
  const now = Date.parse("2026-01-02T03:04:05.000Z");
  const { emailDocument, firestore, updates } = createTransactionHarness({
    state: "ERROR",
    endTime: new Date(now - 60_000),
    attempts: 1,
  });
  const repository = createEmailRetryRepository(firestore);

  const result = await repository.retryFailedEmailIfDue(emailDocument, now);

  assert.equal(result, "retried");
  assert.deepEqual(updates, [{
    reference: emailDocument.ref,
    changes: { "delivery.state": "RETRY" },
  }]);
});

test("repository leaves a failed email alone until the backoff expires", async () => {
  const now = Date.parse("2026-01-02T03:04:05.000Z");
  const { emailDocument, firestore, updates } = createTransactionHarness({
    state: "ERROR",
    endTime: new Date(now - 30_000),
    attempts: 1,
  });
  const repository = createEmailRetryRepository(firestore);

  const result = await repository.retryFailedEmailIfDue(emailDocument, now);

  assert.equal(result, "not_due");
  assert.deepEqual(updates, []);
});
