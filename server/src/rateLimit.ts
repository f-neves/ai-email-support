/**
 * Tiny concurrency limiter (no external deps).
 *
 * The Anthropic SDK already retries 429/5xx with exponential backoff; this
 * complements it by capping how many requests we fire in parallel, so a bulk
 * "process all" run can't blow past the account rate limits at once.
 */
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
  };
}

// Shared limiter for all Claude calls.
export const claudeLimiter = createLimiter(3);
