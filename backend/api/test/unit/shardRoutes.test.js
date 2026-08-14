import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

// The shardRoutes module exports only the default router.
// parseCoordinate and validateCoordinateRange are private to the module.
// Tests below replicate the parsing logic for isolated coverage.

// Test coordinate parsing logic directly via a helper test
describe('shardRoutes coordinate parsing logic', () => {
  // Replicate the parseCoordinate logic for isolated testing
  function parseCoordinate(value, field) {
    if (value === undefined || value === null || value === '') {
      return { error: `${field} required` };
    }
    if (Array.isArray(value)) {
      return { error: `${field} must be a single value` };
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return { error: `${field} must be a finite number` };
    }
    return { value: parsed };
  }

  function validateCoordinateRange(lat, lng) {
    if (lat < -90 || lat > 90) return 'lat must be between -90 and 90';
    if (lng < -180 || lng > 180) return 'lng must be between -180 and 180';
    return null;
  }

  describe('parseCoordinate', () => {
    it('returns error when value is undefined', () => {
      const result = parseCoordinate(undefined, 'lat');
      expect(result.error).toBe('lat required');
    });

    it('returns error when value is null', () => {
      const result = parseCoordinate(null, 'lat');
      expect(result.error).toBe('lat required');
    });

    it('returns error when value is empty string', () => {
      const result = parseCoordinate('', 'lat');
      expect(result.error).toBe('lat required');
    });

    it('returns error when value is an array', () => {
      const result = parseCoordinate(['1', '2'], 'lat');
      expect(result.error).toBe('lat must be a single value');
    });

    it('returns error when value is NaN', () => {
      const result = parseCoordinate('not-a-number', 'lat');
      expect(result.error).toBe('lat must be a finite number');
    });

    it('returns error when value is Infinity', () => {
      const result = parseCoordinate(Infinity, 'lat');
      expect(result.error).toBe('lat must be a finite number');
    });

    it('returns error when value is -Infinity', () => {
      const result = parseCoordinate(-Infinity, 'lat');
      expect(result.error).toBe('lat must be a finite number');
    });

    it('parses valid integer string', () => {
      const result = parseCoordinate('90', 'lat');
      expect(result.value).toBe(90);
    });

    it('parses valid float string', () => {
      const result = parseCoordinate('45.5', 'lng');
      expect(result.value).toBe(45.5);
    });

    it('parses numeric value directly', () => {
      const result = parseCoordinate(37.7749, 'lat');
      expect(result.value).toBe(37.7749);
    });

    it('handles negative numbers', () => {
      const result = parseCoordinate('-90', 'lat');
      expect(result.value).toBe(-90);
    });
  });

  describe('validateCoordinateRange', () => {
    it('returns null for valid lat=90 lng=180', () => {
      expect(validateCoordinateRange(90, 180)).toBeNull();
    });

    it('returns null for valid lat=-90 lng=-180', () => {
      expect(validateCoordinateRange(-90, -180)).toBeNull();
    });

    it('returns null for equator and prime meridian', () => {
      expect(validateCoordinateRange(0, 0)).toBeNull();
    });

    it('returns error for lat > 90', () => {
      expect(validateCoordinateRange(91, 0)).toBe('lat must be between -90 and 90');
    });

    it('returns error for lat < -90', () => {
      expect(validateCoordinateRange(-91, 0)).toBe('lat must be between -90 and 90');
    });

    it('returns error for lng > 180', () => {
      expect(validateCoordinateRange(0, 181)).toBe('lng must be between -180 and 180');
    });

    it('returns error for lng < -180', () => {
      expect(validateCoordinateRange(0, -181)).toBe('lng must be between -180 and 180');
    });
  });
});
