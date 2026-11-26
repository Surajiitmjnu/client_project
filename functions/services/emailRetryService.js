function createEmailRetryService(repository, logger) {
  return async function retryFailedEmails(now = Date.now()) {
    const failedMessages = await repository.listFailedEmailMessages();
    const results = await Promise.all(failedMessages.map((message) =>
      repository.retryFailedEmailIfDue(message, now),
    ));
    const retriedCount = results.filter((result) => result === "retried").length;
    const invalidTimestampCount = results.filter((result) => result === "invalid_timestamp").length;

    if (invalidTimestampCount) {
      logger.warn("Some failed emails have no valid delivery endTime.", {
        count: invalidTimestampCount,
      });
    }
    if (retriedCount) {
      logger.info("Re-queued failed emails.", { count: retriedCount });
    }

    return { retriedCount, invalidTimestampCount };
  };
}

module.exports = { createEmailRetryService };
