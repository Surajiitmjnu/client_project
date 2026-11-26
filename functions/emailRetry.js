const BASE_RETRY_DELAY_MS = 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const MAX_BACKOFF_EXPONENT = 6;

function getEmailRetryDelayMs(attempts) {
  const parsedAttempts = Number(attempts);
  const attemptNumber = Number.isFinite(parsedAttempts)
    ? Math.max(1, Math.floor(parsedAttempts))
    : 1;
  const exponent = Math.min(attemptNumber - 1, MAX_BACKOFF_EXPONENT);
  return Math.min(BASE_RETRY_DELAY_MS * (2 ** exponent), MAX_RETRY_DELAY_MS);
}

function getTimestampMillis(value) {
  if (value && typeof value.toMillis === "function") {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === "string") {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  return null;
}

module.exports = { getEmailRetryDelayMs, getTimestampMillis };
