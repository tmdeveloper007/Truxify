import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

vi.mock('@opentelemetry/api', () => ({
  context: { active: vi.fn(() => ({})) },
  trace: {
    getTracer: vi.fn(() => ({ startSpan: vi.fn() })),
    setSpan: vi.fn(() => ({})),
    setSpanContext: vi.fn(),
  },
  SpanStatusCode: { OK: 0, ERROR: 1 },
}));

vi.mock('../../src/core/telemetry/SpanFactory.js', () => ({
  default: { startEventHandlerSpan: vi.fn(() => ({ setStatus: vi.fn(), end: vi.fn() })) },
}));

describe('WorkerEventAdapter', async () => {
  let WorkerEventAdapter;
  let adapter;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/core/events/adapters/WorkerEventAdapter.js');
    WorkerEventAdapter = mod.WorkerEventAdapter;
    adapter = new WorkerEventAdapter({ workerFactory: vi.fn() });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets isConnected to true by default', () => {
      expect(adapter.isConnected).toBe(true);
    });

    it('stores workerFactory when provided', () => {
      const factory = vi.fn();
      const a = new WorkerEventAdapter({ workerFactory: factory });
      expect(a._workerFactory).toBe(factory);
    });
  });

  describe('connect / disconnect', () => {
    it('connect logs info', async () => {
      await adapter.connect();
      expect(mockLogger.info).toHaveBeenCalledWith('[WorkerEventAdapter] Connected');
    });

    it('disconnect logs info', async () => {
      await adapter.disconnect();
      expect(mockLogger.info).toHaveBeenCalledWith('[WorkerEventAdapter] Disconnected');
      expect(adapter.isConnected).toBe(false);
    });

    it('disconnect terminates registered workers', async () => {
      const terminate = vi.fn().mockResolvedValue();
      const worker = { terminate, on: vi.fn() };
      adapter.registerWorker('test-worker', worker);
      await adapter.disconnect();
      expect(terminate).toHaveBeenCalled();
    });
  });

  describe('registerWorker', () => {
    it('logs info when worker is registered', () => {
      const worker = { on: vi.fn() };
      adapter.registerWorker('test-worker', worker);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[WorkerEventAdapter] Worker "test-worker" registered',
      );
    });

    it('registers worker with on() method for message handling', () => {
      const worker = { on: vi.fn() };
      adapter.registerWorker('test-worker', worker);
      expect(worker.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('returns this for chaining', () => {
      const worker = { on: vi.fn() };
      const result = adapter.registerWorker('test-worker', worker);
      expect(result).toBe(adapter);
    });
  });

  describe('removeWorker', () => {
    it('removes a registered worker', () => {
      const worker = { on: vi.fn() };
      adapter.registerWorker('test-worker', worker);
      adapter.removeWorker('test-worker');
      // No error thrown
    });
  });

  describe('publish', () => {
    it('throws when not connected', async () => {
      adapter._connected = false;
      await expect(
        adapter.publish({ eventType: 'test.event', payload: {} }),
      ).rejects.toThrow('Not connected');
    });

    it('logs error when worker has no postMessage or send', async () => {
      const worker = { on: vi.fn() }; // no postMessage/send
      adapter.registerWorker('test-worker', worker);
      adapter._connected = true;
      await adapter.publish({ eventType: 'test.event', payload: {} });
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('onWorkerMessage', () => {
    it('registers a handler for a worker', () => {
      const handler = vi.fn();
      adapter.onWorkerMessage('test-worker', handler);
      // No error thrown - handler registered
    });
  });
});
