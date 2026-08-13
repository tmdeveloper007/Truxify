import { describe, it, expect } from 'vitest';
import { safeJsonParseWithFallback } from '../../src/lib/requestContext.js';
describe('safeJsonParseWithFallback', () => {
  it('returns parsed object for valid JSON', () => { expect(safeJsonParseWithFallback('{"a":1}', {})).toEqual({ a: 1 }); });
  it('returns fallback for null', () => { expect(safeJsonParseWithFallback(null, { x: 1 })).toEqual({ x: 1 }); });
  it('returns fallback for malformed JSON', () => { expect(safeJsonParseWithFallback('bad{', { y: 2 })).toEqual({ y: 2 }); });
  it('returns fallback for arrays', () => { expect(safeJsonParseWithFallback('[1,2]', { z: 3 })).toEqual({ z: 3 }); });
});
