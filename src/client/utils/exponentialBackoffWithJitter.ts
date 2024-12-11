const INITIAL_RETRY_DELAY_IF_RATE_LIMITED = 5000;
const MAX_RETRY_DELAY_IF_RATE_LIMITED = 600000;

// "Full Jitter" algorithm taken from https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
export function exponentialBackoffWithJitter(numberOfRetries: number): number {
  const rawBackoffTimeMs =
    INITIAL_RETRY_DELAY_IF_RATE_LIMITED * 2 ** numberOfRetries;
  const clippedBackoffTimeMs = Math.min(
    MAX_RETRY_DELAY_IF_RATE_LIMITED,
    rawBackoffTimeMs,
  );
  const jitteredBackoffTimeMs = Math.random() * clippedBackoffTimeMs;
  return jitteredBackoffTimeMs;
}