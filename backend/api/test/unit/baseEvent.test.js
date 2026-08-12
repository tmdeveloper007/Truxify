import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

describe('BaseEvent', async () => {
  let BaseEvent;
  let EventMetadata;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/core/events/BaseEvent.js');
    BaseEvent = mod.BaseEvent;
    const em = await import('../../src/core/events/EventMetadata.js');
    EventMetadata = em.EventMetadata;
  });

  describe('constructor', () => {
    it('creates an event with eventType and payload', () => {
      const event = new BaseEvent({ eventType: 'order.created', payload: { id: 1 } });
      expect(event.eventType).toBe('order.created');
      expect(event.payload).toEqual({ id: 1 });
    });

    it('throws Error when eventType is missing', () => {
      expect(() => new BaseEvent({ payload: {} })).toThrow(
        'BaseEvent requires a non-empty eventType string',
      );
    });

    it('throws Error when eventType is null', () => {
      expect(() => new BaseEvent({ eventType: null, payload: {} })).toThrow();
    });

    it('throws Error when eventType is an empty string', () => {
      expect(() => new BaseEvent({ eventType: '', payload: {} })).toThrow();
    });

    it('uses empty object as default payload', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      expect(event.payload).toEqual({});
    });

    it('uses default category when not specified', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      expect(event.category).toBeTruthy();
    });
  });

  describe('properties', () => {
    it('has an eventId via metadata', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      expect(event.eventId).toBeTruthy();
    });

    it('has a timestamp via metadata', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      expect(event.timestamp).toBeTruthy();
    });

    it('has a source from options', () => {
      const event = new BaseEvent({ eventType: 'test.event', source: 'test-service' });
      expect(event.source).toBe('test-service');
    });

    it('has a category from options', () => {
      const event = new BaseEvent({ eventType: 'test.event', category: 'domain' });
      expect(event.category).toBe('domain');
    });
  });

  describe('withCorrelationId', () => {
    it('sets the correlationId on the event', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      event.withCorrelationId('corr-123');
      expect(event.correlationId).toBe('corr-123');
    });

    it('returns this for chaining', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      const result = event.withCorrelationId('corr-123');
      expect(result).toBe(event);
    });
  });

  describe('withCausationId', () => {
    it('sets the causationId on the event', () => {
      const event = new BaseEvent({ eventType: 'test.event' });
      event.withCausationId('cause-456');
      expect(event.metadata.causationId).toBe('cause-456');
    });
  });

  describe('toJSON', () => {
    it('produces a JSON-serializable object', () => {
      const event = new BaseEvent({ eventType: 'test.event', payload: { data: 'value' } });
      const json = event.toJSON();
      expect(typeof json).toBe('object');
      expect(json.metadata).toBeDefined();
      expect(json.payload).toEqual({ data: 'value' });
    });

    it('can be serialized to a string and parsed back', () => {
      const event = new BaseEvent({ eventType: 'order.created', payload: { id: 42 } });
      const jsonString = JSON.stringify(event.toJSON());
      const parsed = JSON.parse(jsonString);
      expect(parsed.payload.id).toBe(42);
    });
  });

  describe('fromJSON', () => {
    it('reconstructs a BaseEvent from JSON', () => {
      const original = new BaseEvent({
        eventType: 'order.shipped',
        payload: { orderId: 'ORD-789' },
        source: 'fulfillment',
      });
      const json = original.toJSON();
      const reconstructed = BaseEvent.fromJSON(json);
      expect(reconstructed.eventType).toBe('order.shipped');
      expect(reconstructed.payload).toEqual({ orderId: 'ORD-789' });
    });

    it('handles JSON with plain metadata object', () => {
      const json = {
        metadata: {
          eventId: 'evt-123',
          eventType: 'test.event',
          source: 'test',
          category: 'domain',
          version: '1.0.0',
          correlationId: null,
          causationId: null,
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        payload: { key: 'value' },
      };
      const event = BaseEvent.fromJSON(json);
      expect(event.eventType).toBe('test.event');
      expect(event.payload).toEqual({ key: 'value' });
    });
  });
});
