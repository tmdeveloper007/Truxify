import { describe, it, expect, vi } from 'vitest';

describe('truckRoutes', () => {
  it('can be imported', async () => {
    const mod = await import('../../src/routes/truckRoutes.js');
    expect(mod).toBeDefined();
  });
});
