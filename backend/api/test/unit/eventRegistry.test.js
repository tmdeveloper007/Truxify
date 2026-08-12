import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

describe('EventRegistry', async () => {
  let EventRegistry;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/core/events/EventRegistry.js');
    EventRegistry = mod.EventRegistry;
  });

  describe('constructor', () => {
    it('creates an empty registry', () => {
      const registry = new EventRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('register', () => {
    it('registers an event type definition', () => {
      const registry = new EventRegistry();
      const result = registry.register('order.created', {
        source: 'orders',
        category: 'domain',
        description: 'Order was created',
      });
      expect(result).toBe(registry); // chainable
    });

    it('registers with default category', () => {
      const registry = new EventRegistry();
      registry.register('test.event');
      expect(registry.isValid('test.event')).toBe(true);
    });

    it('registers with a validator function', () => {
      const registry = new EventRegistry();
      const validator = vi.fn((payload) => payload.id !== undefined);
      registry.register('order.created', { validator });
      const validation = registry.validate('order.created', { id: 1 });
      expect(validation.valid).toBe(true);
    });

    it('throws when eventType is not a non-empty string', () => {
      const registry = new EventRegistry();
      expect(() => registry.register('', {})).toThrow('eventType must be a non-empty string');
      expect(() => registry.register(null, {})).toThrow('eventType must be a non-empty string');
    });
  });

  describe('isValid', () => {
    it('returns true for registered event type', () => {
      const registry = new EventRegistry();
      registry.register('test.event');
      expect(registry.isValid('test.event')).toBe(true);
    });

    it('returns false for unregistered event type', () => {
      const registry = new EventRegistry();
      expect(registry.isValid('unknown.event')).toBe(false);
    });
  });

  describe('getDefinition', () => {
    it('returns the definition for a registered event type', () => {
      const registry = new EventRegistry();
      registry.register('order.created', {
        source: 'orders',
        category: 'domain',
        description: 'Order created event',
      });
      const def = registry.getDefinition('order.created');
      expect(def.source).toBe('orders');
      expect(def.category).toBe('domain');
      expect(def.description).toBe('Order created event');
    });

    it('returns null for unregistered event type', () => {
      const registry = new EventRegistry();
      expect(registry.getDefinition('unknown.event')).toBe(null);
    });
  });

  describe('validate', () => {
    it('returns invalid for unregistered event type', () => {
      const registry = new EventRegistry();
      const result = registry.validate('unknown.event', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown event type');
    });

    it('validates with custom validator function', () => {
      const registry = new EventRegistry();
      registry.register('order.created', {
        validator: (payload) => payload.id !== undefined,
      });
      expect(registry.validate('order.created', { id: 1 }).valid).toBe(true);
      expect(registry.validate('order.created', {}).valid).toBe(false);
    });

    it('returns valid when no validator is registered', () => {
      const registry = new EventRegistry();
      registry.register('test.event');
      expect(registry.validate('test.event', {}).valid).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    it('returns all registered event type names', () => {
      const registry = new EventRegistry();
      registry.register('event.a');
      registry.register('event.b');
      registry.register('event.c');
      const types = registry.getRegisteredTypes();
      expect(types).toContain('event.a');
      expect(types).toContain('event.b');
      expect(types).toContain('event.c');
    });

    it('returns empty array when no events are registered', () => {
      const registry = new EventRegistry();
      expect(registry.getRegisteredTypes()).toEqual([]);
    });
  });

  describe('remove', () => {
    it('removes a registered event type', () => {
      const registry = new EventRegistry();
      registry.register('test.event');
      registry.remove('test.event');
      expect(registry.isValid('test.event')).toBe(false);
    });

    it('returns this for chaining', () => {
      const registry = new EventRegistry();
      const result = registry.remove('test.event');
      expect(result).toBe(registry);
    });
  });
});
