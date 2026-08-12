import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

describe('InternalEventAdapter', async () => {
  let InternalEventAdapter;
  let adapter;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/core/events/adapters/InternalEventAdapter.js');
    InternalEventAdapter = mod.InternalEventAdapter;
    adapter = new InternalEventAdapter();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets isConnected to true by default', () => {
      expect(adapter.isConnected).toBe(true);
    });

    it('sets max listeners to 50', () => {
      expect(adapter.getMaxListeners()).toBe(50);
    });
  });

  describe('connect / disconnect', () => {
    it('connect sets isConnected to true', async () => {
      adapter._connected = false;
      await adapter.connect();
      expect(adapter.isConnected).toBe(true);
    });

    it('disconnect sets isConnected to false', async () => {
      await adapter.disconnect();
      expect(adapter.isConnected).toBe(false);
    });

    it('disconnect removes all listeners', async () => {
      const handler = vi.fn();
      adapter.on('test.event', handler);
      await adapter.disconnect();
      expect(adapter.listenerCount('test.event')).toBe(0);
    });
  });

  describe('publish', () => {
    it('throws when not connected', async () => {
      adapter._connected = false;
      await expect(
        adapter.publish({ eventType: 'test.event', payload: {} }),
      ).rejects.toThrow('Not connected');
    });

    it('emits the event locally', async () => {
      const handler = vi.fn();
      adapter.on('test.event', handler);
      await adapter.publish({ eventType: 'test.event', payload: { data: 42 } });
      expect(handler).toHaveBeenCalledWith({ eventType: 'test.event', payload: { data: 42 } });
    });
  });

  describe('subscribe', () => {
    it('throws when not connected', async () => {
      adapter._connected = false;
      await expect(adapter.subscribe('test.event', vi.fn())).rejects.toThrow('Not connected');
    });

    it('subscribes a handler to an event type', async () => {
      const handler = vi.fn();
      await adapter.subscribe('test.event', handler);
      expect(adapter.listenerCount('test.event')).toBe(1);
    });
  });

  describe('unsubscribe', () => {
    it('removes a handler from an event type', async () => {
      const handler = vi.fn();
      adapter.on('test.event', handler);
      await adapter.unsubscribe('test.event', handler);
      expect(adapter.listenerCount('test.event')).toBe(0);
    });
  });
});
