import { describe, expect, it } from 'vitest';
import { createQuotaStore, QuotaStoreUnavailableError } from '../quotaStore.mjs';

describe('AI quota store', () => {
  it('enforces a local fixed-window quota when no shared store is configured', async () => {
    let currentTime = 1_000;
    const store = createQuotaStore({ now: () => currentTime });

    expect((await store.consume({ scope: 'client:one', limit: 2, windowMs: 60_000 })).allowed).toBe(true);
    expect((await store.consume({ scope: 'client:one', limit: 2, windowMs: 60_000 })).allowed).toBe(true);
    const exceeded = await store.consume({ scope: 'client:one', limit: 2, windowMs: 60_000 });
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.retryAfter).toBe(59);

    currentTime = 60_000;
    expect((await store.consume({ scope: 'client:one', limit: 2, windowMs: 60_000 })).allowed).toBe(true);
  });

  it('uses atomic increment windows through the Redis REST pipeline', async () => {
    const calls = [];
    const store = createQuotaStore({
      url: 'https://redis.example.com',
      token: 'secret',
      now: () => 120_000,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify([{ result: '3' }, { result: '1' }]), { status: 200 });
      },
    });

    const result = await store.consume({ scope: 'global-minute', limit: 3, windowMs: 60_000 });
    expect(result).toMatchObject({ allowed: true, count: 3, remote: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://redis.example.com/pipeline');
    expect(calls[0].init.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(calls[0].init.body)[0][0]).toBe('INCR');
  });

  it('fails closed when a configured shared store cannot be reached', async () => {
    const store = createQuotaStore({
      url: 'https://redis.example.com',
      failClosed: true,
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });

    await expect(store.consume({ scope: 'global-minute', limit: 3, windowMs: 60_000 })).rejects.toBeInstanceOf(
      QuotaStoreUnavailableError
    );
  });
});
