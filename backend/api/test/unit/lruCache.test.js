import { describe, it, expect } from 'vitest';
import { SynchronizedLRU } from '../../src/lib/lruCache.js';
describe('SynchronizedLRU', () => {
  it('evicts oldest', () => {
    const c = new SynchronizedLRU(2);
    c.set('a', 1); c.set('b', 2); c.set('c', 3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
  });
  it('refreshes on get', () => {
    const c = new SynchronizedLRU(2);
    c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
  });
});
