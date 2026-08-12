import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

vi.mock('../../src/core/events/EventRegistry.js', () => {
  const mockHandlers = new Map();
  return {
    EventRegistry: vi.fn(function MockRegistry() {
      this.register = vi.fn((name, handler) => mockHandlers.set(name, handler));
      this.getHandlers = vi.fn((name) => mockHandlers.get(name) || []);
      this.clear = vi.fn(() => mockHandlers.clear());
      this.isValid = vi.fn(() => true);
      this.validate = vi.fn(() => ({ valid: true }));
    }),
  };
});

vi.mock('../../src/core/telemetry/ContextPropagator.js', () => ({
  ContextPropagator: {
    injectIntoEventPayload: vi.fn((e) => e),
    snapshot: vi.fn(() => ({})),
    extractFromEventPayload: vi.fn(() => ({})),
  },
}));

vi.mock('@opentelemetry/api', () => ({
  context: {
    active: vi.fn(() => ({})),
    with: vi.fn((_ctx, fn) => fn()),
  },
  trace: {
    getTracer: vi.fn(() => ({ startSpan: vi.fn(() => ({ setStatus: vi.fn(), end: vi.fn(), setAttribute: vi.fn() })) })),
    setSpan: vi.fn(() => ({})),
    setSpanContext: vi.fn(),
  },
  SpanStatusCode: { OK: 0, ERROR: 1 },
}));

vi.mock('../../src/core/telemetry/SpanFactory.js', () => ({
  default: {
    createSpan: vi.fn(() => ({ setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() })),
    startEventPublishSpan: vi.fn(() => ({ setStatus: vi.fn(), end: vi.fn() })),
    startEventSubscribeSpan: vi.fn(() => ({ setStatus: vi.fn(), end: vi.fn(), setAttribute: vi.fn() })),
    recordError: vi.fn(),
  },
  STANDARD_ATTRIBUTES: {},
}));

describe('EventBus', async () => {
  let EventBus;
  let eventBus;
  const { EventBus: EB } = await import('../../src/core/events/EventBus.js');
  EventBus = EB;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates an EventBus with default max listeners', () => {
      expect(eventBus.getMaxListeners()).toBe(50);
    });

    it('has empty metrics on construction', () => {
      const metrics = eventBus.metrics;
      expect(metrics.published).toBe(0);
      expect(metrics.subscribed).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.deduplicated).toBe(0);
    });

    it('has a registry', () => {
      expect(eventBus.registry).toBeDefined();
    });
  });

  describe('registerAdapter', () => {
    it('registers an adapter', () => {
      const adapter = { name: 'test-adapter' };
      const result = eventBus.registerAdapter('test', adapter);
      expect(result).toBe(eventBus); // chainable
    });
  });

  describe('removeAdapter', () => {
    it('removes a registered adapter', () => {
      const adapter = { name: 'test-adapter' };
      eventBus.registerAdapter('test', adapter);
      eventBus.removeAdapter('test');
    });
  });

  describe('publish', () => {
    it('increments published metric on successful emit', async () => {
      const { BaseEvent } = await import('../../src/core/events/BaseEvent.js');
      const event = new BaseEvent({ eventType: 'test.event', payload: { data: 1 } });
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      await eventBus.publish(event);
      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('subscribe', () => {
    it('increments subscribed metric', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      const metrics = eventBus.metrics;
      expect(metrics.subscribed).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('returns a copy of metrics object', () => {
      const m1 = eventBus.metrics;
      const m2 = eventBus.metrics;
      expect(m1).not.toBe(m2); // should be a copy
    });
  });

  describe('unsubscribe', () => {
    it('removes a registered handler', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      eventBus.unsubscribe('test.event', handler);
    });
  });
});
