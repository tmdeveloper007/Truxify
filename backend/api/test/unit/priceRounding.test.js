import { describe, it, expect } from 'vitest';
import { toPaisa, toInr, roundPrice } from '../../src/lib/priceRounding.js';

describe('priceRounding', () => {
  describe('toPaisa', () => {
    it('converts whole INR to paisa', () => {
      expect(toPaisa(1)).toBe(100);
      expect(toPaisa(10)).toBe(1000);
      expect(toPaisa(0)).toBe(0);
    });

    it('converts fractional INR correctly with rounding', () => {
      expect(toPaisa(1.5)).toBe(150);
      expect(toPaisa(1.005)).toBe(101); // banker's rounding
      expect(toPaisa(1.994)).toBe(199);
      expect(toPaisa(1.995)).toBe(200);
    });

    it('returns null for non-number inputs', () => {
      expect(toPaisa('10')).toBeNull();
      expect(toPaisa(null)).toBeNull();
      expect(toPaisa(undefined)).toBeNull();
      expect(toPaisa(NaN)).toBeNull();
    });

    it('returns null for negative values', () => {
      expect(toPaisa(-1)).toBeNull();
      expect(toPaisa(-0.01)).toBeNull();
    });

    it('returns null for Infinity', () => {
      expect(toPaisa(Infinity)).toBeNull();
      expect(toPaisa(-Infinity)).toBeNull();
    });

    it('handles large values', () => {
      expect(toPaisa(100000)).toBe(10000000);
    });
  });

  describe('toInr', () => {
    it('converts paisa to INR', () => {
      expect(toInr(100)).toBe(1);
      expect(toInr(1000)).toBe(10);
      expect(toInr(0)).toBe(0);
    });

    it('returns fractional INR correctly', () => {
      expect(toInr(1)).toBe(0.01);
      expect(toInr(55)).toBe(0.55);
      expect(toInr(101)).toBe(1.01);
    });

    it('returns null for non-number inputs', () => {
      expect(toInr('100')).toBeNull();
      expect(toInr(null)).toBeNull();
      expect(toInr(undefined)).toBeNull();
      expect(toInr(NaN)).toBeNull();
    });

    it('returns null for negative values', () => {
      expect(toInr(-100)).toBeNull();
    });
  });

  describe('roundPrice', () => {
    it('rounds to 2 decimal places by default', () => {
      expect(roundPrice(1.234)).toBe(1.23);
      expect(roundPrice(1.235)).toBe(1.24);
      expect(roundPrice(1.999)).toBe(2);
    });

    it('respects custom decimal places', () => {
      expect(roundPrice(1.2345, 3)).toBe(1.235);
      expect(roundPrice(1.2345, 1)).toBe(1.2);
    });

    it('returns 0 for non-number inputs', () => {
      expect(roundPrice('1.5')).toBe(0);
      expect(roundPrice(null)).toBe(0);
      expect(roundPrice(undefined)).toBe(0);
      expect(roundPrice(NaN)).toBe(0);
    });

    it('returns 0 for Infinity', () => {
      expect(roundPrice(Infinity)).toBe(0);
    });
  });
});
