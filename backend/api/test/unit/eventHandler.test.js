import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

vi.mock('@opentelemetry/api', () => ({
  context: {
    active: vi.fn(() => ({})),
    with: vi.fn((_ctx, fn) => fn()),
  },
  trace: {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        end: vi.fn(),
      })),
    })),
    setSpan: vi.fn(() => ({})),
  },
  SpanStatusCode: { OK: 0, ERROR: 1 },
}));

vi.mock('../../src/core/telemetry/SpanFactory.js', () => ({
  default: {
    startEventHandlerSpan: vi.fn(() => ({
      setStatus: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    })),
    recordError: vi.fn(),
  },
}));

describe('EventHandler', async () => {
  let EventHandler;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/core/events/EventHandler.js');
    EventHandler = mod.EventHandler;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws when handler is not a function', () => {
      expect(() => new EventHandler('not a function')).toThrow(
        'EventHandler requires a function handler',
      );
    });

    it('sets the handler name from options', () => {
      const handler = new EventHandler(vi.fn(), { name: 'my-handler' });
      expect(handler.name).toBe('my-handler');
    });

    it('sets the handler name from function name', () => {
      function myNamedHandler() {}
      const h = new EventHandler(myNamedHandler);
      expect(h.name).toBe('myNamedHandler');
    });

    it('sets anonymous name when no name available', () => {
      const h = new EventHandler(() => {});
      expect(h.name).toBe('anonymous');
    });

    it('uses default retryCount of 0', () => {
      const h = new EventHandler(vi.fn());
      expect(h._retryCount).toBe(0);
    });

    it('uses default timeout of 30000ms', () => {
      const h = new EventHandler(vi.fn());
      expect(h._timeout).toBe(30000);
    });
  });

  describe('handle', () => {
    it('runs the handler and returns result', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const h = new EventHandler(fn);
      const result = await h.handle({ eventType: 'test.event', payload: { data: 1 } });
      expect(result).toBe('result');
    });

    it('propagates errors from the handler', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('handler failed'));
      const h = new EventHandler(fn);
      await expect(h.handle({ eventType: 'test.event' })).rejects.toThrow('handler failed');
    });

    it('calls onError callback when provided and handler throws', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('handler failed'));
      const onError = vi.fn().mockReturnValue('fallback');
      const h = new EventHandler(fn, { onError });
      const result = await h.handle({ eventType: 'test.event' });
      expect(result).toBe('fallback');
    });
  });

  describe('static wrap', () => {
    it('creates an EventHandler from a function', () => {
      const fn = vi.fn();
      const h = EventHandler.wrap(fn, { name: 'wrapped' });
      expect(h.name).toBe('wrapped');
    });
  });
});
