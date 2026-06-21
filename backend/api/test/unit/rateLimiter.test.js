import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  redisClient: null,
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { userKeyGenerator } = await import('../../src/middleware/rateLimiter.js');

describe('userKeyGenerator', () => {
  it('keys by the authenticated user id', () => {
    const req = { user: { id: 'user-1' }, ip: '203.0.113.7' };
    expect(userKeyGenerator(req)).toBe('user:user-1');
  });

  it('falls back to the firebase uid when no id is present', () => {
    const req = { user: { uid: 'fb-uid-9' }, ip: '203.0.113.7' };
    expect(userKeyGenerator(req)).toBe('uid:fb-uid-9');
  });

  it('gives two users behind the same IP independent keys', () => {
    const ip = '203.0.113.7';
    const a = userKeyGenerator({ user: { id: 'user-a' }, ip });
    const b = userKeyGenerator({ user: { id: 'user-b' }, ip });
    expect(a).not.toBe(b);
  });
});
