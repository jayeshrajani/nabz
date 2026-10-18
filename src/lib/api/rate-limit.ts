/** Fixed-window, per-key limiter. In-memory per instance: adequate abuse protection for a single small Cloud Run service. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string): boolean {
    const t = now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}
