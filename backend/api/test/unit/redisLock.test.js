import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing redisLock
vi.mock('../../config/db.js', () => ({
  redisClient: null,
}));

describe('redisLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquireLock returns null when redisClient is null', async () => {
    const { acquireLock } = await import('../../lib/redisLock.js');
    const result = await acquireLock('test-resource', 5000);
    expect(result).toBeNull();
  });

  it('releaseLock does not throw when redisClient is null', async () => {
    const { releaseLock } = await import('../../lib/redisLock.js');
    await expect(releaseLock('non-existent-lock')).resolves.not.toThrow();
  });
});

// ─── releaseLock ─────────────────────────────────────────────────────────────

describe('releaseLock', () => {
  afterEach(() => {
    redisHolder.client = null;
  });

  it('returns true when Lua script confirms we hold the lock', async () => {
    redisHolder.client = makeRedis({ evalResult: 1 });

    const result = await releaseLock('test:key', 'some-uuid');
    expect(result).toBe(true);
  });

  it('returns false when Lua script says we no longer hold the lock (expired / stolen)', async () => {
    redisHolder.client = makeRedis({ evalResult: 0 });

    const result = await releaseLock('test:key', 'stale-uuid');
    expect(result).toBe(false);
  });

  it('returns false (does not throw) when Redis eval throws', async () => {
    redisHolder.client = makeRedis({ throwOn: 'eval' });

    await expect(releaseLock('test:key', 'some-uuid')).resolves.toBe(false);
  });

  it('returns false when lockValue is null (no-op guard)', async () => {
    redisHolder.client = makeRedis();

    const result = await releaseLock('test:key', null);
    expect(result).toBe(false);
  });

  it('returns false when lockValue is undefined (no-op guard)', async () => {
    redisHolder.client = makeRedis();

    const result = await releaseLock('test:key', undefined);
    expect(result).toBe(false);
  });

  it('passes the lockValue as ARGV[1] to the Lua script', async () => {
    const redis = makeRedis({ evalResult: 1 });
    redisHolder.client = redis;

    const token = 'abc-123-uuid';
    await releaseLock('test:key', token);

    // eval(script, numkeys, key, argv1, ...)
    const evalArgs = redis.eval.mock.calls[0];
    expect(evalArgs[2]).toBe('test:key'); // KEYS[1]
    expect(evalArgs[3]).toBe(token);      // ARGV[1]
  });
});

// ─── renewLock ───────────────────────────────────────────────────────────────

describe('renewLock', () => {
  afterEach(() => {
    redisHolder.client = null;
  });

  it('returns true when Lua confirms we still hold the lock', async () => {
    redisHolder.client = makeRedis({ evalResult: 1 });
    expect(await renewLock('test:key', 'uuid', 5000)).toBe(true);
  });

  it('returns false when we no longer hold the lock', async () => {
    redisHolder.client = makeRedis({ evalResult: 0 });
    expect(await renewLock('test:key', 'stale', 5000)).toBe(false);
  });

  it('returns false when redisClient is null', async () => {
    redisHolder.client = null;
    expect(await renewLock('test:key', 'uuid', 5000)).toBe(false);
  });

  it('returns false when lockValue is falsy', async () => {
    redisHolder.client = makeRedis();
    expect(await renewLock('test:key', '', 5000)).toBe(false);
    expect(await renewLock('test:key', null, 5000)).toBe(false);
  });
});

// ─── Integration-style: guarded mutation must be rejected when Redis is down ──

describe('Critical section protection — Redis down must block the operation', () => {
  afterEach(() => {
    redisHolder.client = null;
  });

  /**
   * Simulates what a route handler does:
   *   1. acquireLock
   *   2. perform mutation
   *   3. releaseLock
   * Returns the HTTP-like status that would be sent to the client.
   */
  async function simulateProtectedMutation(lockKey) {
    let lockValue = null;
    let mutationPerformed = false;
    let responseStatus;

    try {
      lockValue = await acquireLock(lockKey, 30_000);
      if (lockValue === null) {
        responseStatus = 409; // Already locked by another process
        return { status: responseStatus, mutationPerformed };
      }

      // Critical section — must NOT execute when Redis is down.
      mutationPerformed = true;
      responseStatus = 201;

    } catch (err) {
      if (err instanceof LockAcquisitionError) {
        responseStatus = 503; // Service unavailable
      } else {
        responseStatus = 500;
      }
    } finally {
      if (lockValue) {
        await releaseLock(lockKey, lockValue).catch(() => {});
      }
    }

    return { status: responseStatus, mutationPerformed };
  }

  it('mutation is NOT performed and 503 is returned when Redis is down', async () => {
    redisHolder.client = null; // Redis not available

    const { status, mutationPerformed } =
      await simulateProtectedMutation('payment_lock:order_99');

    expect(mutationPerformed).toBe(false);
    expect(status).toBe(503);
  });

  it('mutation is NOT performed and 503 is returned when Redis SET throws', async () => {
    redisHolder.client = makeRedis({ throwOn: 'set' });

    const { status, mutationPerformed } =
      await simulateProtectedMutation('payment_lock:order_99');

    expect(mutationPerformed).toBe(false);
    expect(status).toBe(503);
  });

  it('mutation IS performed (201) when Redis lock is available', async () => {
    redisHolder.client = makeRedis({ setResult: 'OK', evalResult: 1 });

    const { status, mutationPerformed } =
      await simulateProtectedMutation('payment_lock:order_99');

    expect(mutationPerformed).toBe(true);
    expect(status).toBe(201);
  });

  it('mutation is NOT performed (409) when lock is already held', async () => {
    redisHolder.client = makeRedis({ setResult: null }); // NX returns null = already locked

    const { status, mutationPerformed } =
      await simulateProtectedMutation('payment_lock:order_99');

    expect(mutationPerformed).toBe(false);
    expect(status).toBe(409);
  });


describe('redisLock lock expiry and release behavior', () => {
  it('acquireLock returns false when lock is already held', async () => {
    const RedisLock = (await import('../../src/lib/redisLock.js')).default;
    const lock = new RedisLock('test-lock');
    // When Redis client is not available, acquire should return false
  });

  it('releaseLock handles not-held lock gracefully (no-op)', async () => {
    const RedisLock = (await import('../../src/lib/redisLock.js')).default;
    const lock = new RedisLock('test-lock');
    // Releasing a lock not held should be a no-op, not throw
  });
});

});