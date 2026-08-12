import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing module under test
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = vi.fn(() => ({
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue('OK'),
    psubscribe: vi.fn().mockResolvedValue('OK'),
    unsubscribe: vi.fn().mockResolvedValue('OK'),
    publish: vi.fn().mockResolvedValue(1),
  }));
  return { default: mockRedis };
});

// Mock dependencies
vi.mock('../../src/cache/CacheNamespace.js', () => ({
  CacheNamespace: {
    isValid: vi.fn((ns) => typeof ns === 'string' && ns.length > 0),
    get: vi.fn(() => ({ enablePubSub: true })),
  },
}));

vi.mock('../../src/cache/CacheKeyBuilder.js', () => ({
  CacheKeyBuilder: {
    pubSubChannel: vi.fn((ns) => `cache:${ns}`),
  },
}));

vi.mock('../../src/cache/CacheEvent.js', () => ({
  CacheEventType: {
    INVALIDATE_KEY: 'INVALIDATE_KEY',
  },
  createCacheEvent: vi.fn(() => ({ id: 'evt-1', type: 'INVALIDATE_KEY' })),
  serializeCacheEvent: vi.fn(() => '{"id":"evt-1","type":"INVALIDATE_KEY"}'),
}));

const logger = (await import('../../src/middleware/logger.js')).default;

describe('CachePublisher', async () => {
  let CachePublisher;

  beforeEach(async () => {
    vi.resetModules();
    // Reset module-level state by re-importing
    CachePublisher = await import('../../src/cache/CachePublisher.js');
    vi.clearAllMocks();
  });

  describe('initCachePublisher', () => {
    it('returns early when redisClient is null', () => {
      CachePublisher.initCachePublisher(null);
      expect(logger.warn).toHaveBeenCalledWith(
        '[CachePublisher] No Redis client provided — Pub/Sub disabled.',
      );
    });

    it('returns early when redisClient is undefined', () => {
      CachePublisher.initCachePublisher(undefined);
      expect(logger.warn).toHaveBeenCalledWith(
        '[CachePublisher] No Redis client provided — Pub/Sub disabled.',
      );
    });

    it('sets publishClient when valid redisClient is provided but REDIS_URL is missing', () => {
      const mockClient = { on: vi.fn() };
      CachePublisher.initCachePublisher(mockClient);
      // Should warn about missing REDIS_URL
      expect(logger.warn).toHaveBeenCalledWith(
        '[CachePublisher] REDIS_URL not set — Pub/Sub subscriber disabled.',
      );
    });
  });

  describe('publishInvalidation', () => {
    it('returns early when publishClient is not initialized', async () => {
      const result = await CachePublisher.publishInvalidation('orders', {
        type: 'INVALIDATE_KEY',
      });
      expect(result).toBeUndefined();
    });

    it('returns early when namespace is invalid', async () => {
      const CacheNamespace = await import('../../src/cache/CacheNamespace.js');
      CacheNamespace.CacheNamespace.isValid.mockReturnValue(false);
      const result = await CachePublisher.publishInvalidation('', {});
      expect(result).toBeUndefined();
    });
  });

  describe('subscribeToInvalidation', () => {
    it('returns early when not initialized', () => {
      const handler = vi.fn();
      CachePublisher.subscribeToInvalidation('orders', handler);
      // No error thrown - graceful degradation
    });
  });

  describe('getInstanceId', () => {
    it('returns a string starting with instance-', () => {
      const id = CachePublisher.getInstanceId();
      expect(typeof id).toBe('string');
      expect(id.startsWith('instance-')).toBe(true);
    });
  });

  describe('isInitialized', () => {
    it('returns false before init', () => {
      expect(CachePublisher.isInitialized()).toBe(false);
    });
  });

  describe('closeCachePublisher', () => {
    it('does not throw when subscriber is null', async () => {
      await expect(CachePublisher.closeCachePublisher()).resolves.not.toThrow();
    });
  });

  describe('setInstanceId', () => {
    it('sets a custom instance id', () => {
      CachePublisher.setInstanceId('test-instance-123');
      expect(CachePublisher.getInstanceId()).toBe('test-instance-123');
    });
  });
});
