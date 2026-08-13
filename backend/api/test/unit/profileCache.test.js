import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCacheStats,
  resetCacheStats,
} from '../../lib/profileCache.js';

describe('profileCache stats', () => {
  beforeEach(() => {
    resetCacheStats();
  });

  it('returns zero stats on fresh reset', () => {
    const stats = getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.sets).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.hitRate).toBe('0%');
  });

  it('hit rate is 0% when no requests made', () => {
    const stats = getCacheStats();
    expect(stats.hitRate).toBe('0%');
  });

  describe('isValidCachedSupabaseProfile', () => {
    it('returns false when userId is not a non-empty string', async () => {
      const { isValidCachedSupabaseProfile } = await import('../../src/lib/profileCache.js');
      const validProfile = { id: 'user-123', role: 'driver', isActive: true };
      expect(isValidCachedSupabaseProfile(null, validProfile)).toBe(false);
      expect(isValidCachedSupabaseProfile('', validProfile)).toBe(false);
      expect(isValidCachedSupabaseProfile(123, validProfile)).toBe(false);
      expect(isValidCachedSupabaseProfile('   ', validProfile)).toBe(false);
    });
  });
});


// === Spec 9 test ===
import { describe, it, expect } from 'vitest';
import { computeTtlSeconds } from '../../src/lib/profileCache.js';
describe('computeTtlSeconds', () => {
  it('past → 0', () => { expect(computeTtlSeconds(1000, 2000)).toBe(0); });
  it('60s future → 60', () => { expect(computeTtlSeconds(60_000, 0)).toBe(60); });
  it('rounds up', () => { expect(computeTtlSeconds(1500, 0)).toBe(2); });
});

