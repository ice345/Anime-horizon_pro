const encodeScope = (scope) => Buffer.from(String(scope)).toString('base64url');

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export class QuotaStoreUnavailableError extends Error {
  constructor(cause) {
    super('Shared AI quota store is unavailable');
    this.name = 'QuotaStoreUnavailableError';
    this.cause = cause;
  }
}

const createLocalBucket = (buckets, key, now, windowMs) => {
  const bucket = Math.floor(now / windowMs);
  const bucketKey = `${key}:${bucket}`;
  const current = buckets.get(bucketKey) || { count: 0, bucketEndsAt: (bucket + 1) * windowMs };
  current.count += 1;
  buckets.set(bucketKey, current);

  for (const [candidateKey, candidate] of buckets) {
    if (candidate.bucketEndsAt <= now) buckets.delete(candidateKey);
  }

  return current;
};

const buildDecision = (count, limit, bucketEndsAt, now, remote) => ({
  allowed: count <= limit,
  count,
  limit,
  remote,
  retryAfter: Math.max(1, Math.ceil((bucketEndsAt - now) / 1000)),
});

/**
 * A fixed-window quota store. Configure AI_QUOTA_REDIS_URL/TOKEN to make the
 * counters shared by all app instances; otherwise it intentionally falls back
 * to a per-process store for local development.
 */
export const createQuotaStore = ({
  url = process.env.AI_QUOTA_REDIS_URL || '',
  token = process.env.AI_QUOTA_REDIS_TOKEN || '',
  failClosed = url ? process.env.AI_QUOTA_FAIL_CLOSED !== 'false' : false,
  timeoutMs = positiveInteger(process.env.AI_QUOTA_TIMEOUT_MS, 2_000),
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) => {
  const normalizedUrl = String(url).trim().replace(/\/$/, '');
  const localBuckets = new Map();

  const consumeLocal = ({ scope, limit, windowMs, currentTime }) => {
    const current = createLocalBucket(localBuckets, scope, currentTime, windowMs);
    return buildDecision(current.count, limit, current.bucketEndsAt, currentTime, false);
  };

  const consumeShared = async ({ scope, limit, windowMs, currentTime }) => {
    if (!normalizedUrl) return consumeLocal({ scope, limit, windowMs, currentTime });

    const bucket = Math.floor(currentTime / windowMs);
    const bucketEndsAt = (bucket + 1) * windowMs;
    const key = `anime-horizon:ai:${encodeScope(scope)}:${bucket}`;
    const ttlSeconds = Math.max(60, Math.ceil(windowMs / 1000) + 60);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    try {
      if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
      const response = await fetchImpl(`${normalizedUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, ttlSeconds],
        ]),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`quota store returned ${response.status}`);
      const payload = await response.json();
      const count = Number(payload?.[0]?.result);
      if (!Number.isInteger(count) || count < 1) throw new Error('quota store returned an invalid counter');
      return buildDecision(count, limit, bucketEndsAt, currentTime, true);
    } catch (error) {
      if (failClosed) throw new QuotaStoreUnavailableError(error);
      return consumeLocal({ scope, limit, windowMs, currentTime });
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    isShared: Boolean(normalizedUrl),
    consume: ({ scope, limit, windowMs }) => {
      const safeLimit = positiveInteger(limit, 1);
      const safeWindowMs = positiveInteger(windowMs, 60_000);
      return consumeShared({ scope, limit: safeLimit, windowMs: safeWindowMs, currentTime: now() });
    },
    reset: () => localBuckets.clear(),
  };
};
