const { getEmailRetryDelayMs, getTimestampMillis } = require("../emailRetry");

const MAX_EMAILS_PER_RUN = 100;

function createEmailRetryRepository(firestore) {
  return {
    async listFailedEmailMessages() {
      const snapshot = await firestore.collection("mail")
        .where("delivery.state", "==", "ERROR")
        .get();

      return snapshot.docs
        .sort((first, second) => {
          const firstAttemptAt = getTimestampMillis(first.get("delivery.endTime")) ?? Number.MAX_SAFE_INTEGER;
          const secondAttemptAt = getTimestampMillis(second.get("delivery.endTime")) ?? Number.MAX_SAFE_INTEGER;
          return firstAttemptAt - secondAttemptAt;
        })
        .slice(0, MAX_EMAILS_PER_RUN);
    },

    async retryFailedEmailIfDue(emailDocument, now) {
      const initialDelivery = emailDocument.get?.("delivery");
      if (initialDelivery) {
        if (initialDelivery.state !== "ERROR") return "no_longer_failed";
        const initialLastAttemptAt = getTimestampMillis(initialDelivery.endTime);
        if (initialLastAttemptAt === null) return "invalid_timestamp";
        if (now - initialLastAttemptAt < getEmailRetryDelayMs(initialDelivery.attempts)) {
          return "not_due";
        }
      }

      return firestore.runTransaction(async (transaction) => {
        const currentDocument = await transaction.get(emailDocument.ref);
        if (!currentDocument.exists) return "missing";

        const delivery = currentDocument.get("delivery");
        if (delivery?.state !== "ERROR") return "no_longer_failed";

        const lastAttemptAt = getTimestampMillis(delivery.endTime);
        if (lastAttemptAt === null) return "invalid_timestamp";

        const retryDelay = getEmailRetryDelayMs(delivery.attempts);
        if (now - lastAttemptAt < retryDelay) return "not_due";

        transaction.update(emailDocument.ref, { "delivery.state": "RETRY" });
        return "retried";
      });
    },
  };
}

module.exports = { createEmailRetryRepository };
