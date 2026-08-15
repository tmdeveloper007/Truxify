import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, isValidCursor } from '../../src/utils/cursorPagination.js';

describe('cursorPagination', () => {
  describe('encodeCursor', () => {
    it('encodes a cursor with id and createdAt', () => {
      const data = { id: 'abc123', createdAt: '2024-01-01T00:00:00.000Z' };
      const cursor = encodeCursor(data);
      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
    });

    it('produces URL-safe base64', () => {
      const cursor = encodeCursor({ id: 'test', ts: 123 });
      expect(cursor).not.toMatch(/[+/=]/);
    });

    it('round-trips through decodeCursor', () => {
      const original = { id: 'xyz789', sortKey: '2024-06-15' };
      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual(original);
    });

    it('encodes empty object', () => {
      const cursor = encodeCursor({});
      expect(typeof cursor).toBe('string');
      expect(decodeCursor(cursor)).toEqual({});
    });
  });

  describe('decodeCursor', () => {
    it('decodes a valid cursor string', () => {
      const encoded = encodeCursor({ id: 'order-42', sort: '2024-07-01' });
      const result = decodeCursor(encoded);
      expect(result).toEqual({ id: 'order-42', sort: '2024-07-01' });
    });

    it('returns null for non-string input', () => {
      expect(decodeCursor(null)).toBeNull();
      expect(decodeCursor(undefined)).toBeNull();
      expect(decodeCursor(12345)).toBeNull();
      expect(decodeCursor({})).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(decodeCursor('')).toBeNull();
    });

    it('returns null for invalid base64', () => {
      expect(decodeCursor('not-valid-base64!!!')).toBeNull();
    });

    it('returns null for non-object JSON', () => {
      const encoded = Buffer.from(JSON.stringify('just a string')).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });

    it('returns null for array JSON', () => {
      const encoded = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });

    it('returns null for null JSON', () => {
      const encoded = Buffer.from(JSON.stringify(null)).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });

    it('accepts cursor with valid positive page_size', () => {
      const encoded = encodeCursor({ id: '123', page_size: 20 });
      const result = decodeCursor(encoded);
      expect(result.page_size).toBe(20);
    });

    it('returns null for cursor with negative page_size', () => {
      const encoded = Buffer.from(
        JSON.stringify({ id: '123', page_size: -5 })
      ).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });

    it('returns null for cursor with zero page_size', () => {
      const encoded = Buffer.from(
        JSON.stringify({ id: '123', page_size: 0 })
      ).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });

    it('returns null for cursor with non-integer page_size', () => {
      const encoded = Buffer.from(
        JSON.stringify({ id: '123', page_size: 10.5 })
      ).toString('base64url');
      expect(decodeCursor(encoded)).toBeNull();
    });
  });

  describe('isValidCursor', () => {
    it('returns true for a valid cursor', () => {
      const encoded = encodeCursor({ id: 'abc' });
      expect(isValidCursor(encoded)).toBe(true);
    });

    it('returns false for an invalid cursor', () => {
      expect(isValidCursor('not-valid')).toBe(false);
      expect(isValidCursor('')).toBe(false);
      expect(isValidCursor(null)).toBe(false);
    });

    it('returns false for cursor with negative page_size', () => {
      const encoded = Buffer.from(
        JSON.stringify({ id: '123', page_size: -1 })
      ).toString('base64url');
      expect(isValidCursor(encoded)).toBe(false);
    });
  });
});
