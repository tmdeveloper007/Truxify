import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

describe('HealthAggregator', async () => {
  let HealthAggregator;
  let HealthStatus;
  const { HealthStatus: HS } = await import('../../src/core/health/HealthCheck.js');
  HealthStatus = HS;
  const { HealthAggregator: HA } = await import('../../src/core/health/HealthAggregator.js');
  HealthAggregator = HA;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates an aggregator with no registered checks', () => {
      const aggregator = new HealthAggregator();
      expect(aggregator).toBeDefined();
    });
  });

  describe('register', () => {
    it('registers a health check function', () => {
      const aggregator = new HealthAggregator();
      const checkFn = vi.fn().mockResolvedValue({ status: HealthStatus.HEALTHY });
      aggregator.register('test-service', checkFn);
      expect(aggregator._checks.length).toBe(1);
      expect(aggregator._checks[0].name).toBe('test-service');
    });

    it('registers with critical flag', () => {
      const aggregator = new HealthAggregator();
      const checkFn = vi.fn();
      aggregator.register('critical-service', checkFn, { critical: true });
      expect(aggregator._checks[0].critical).toBe(true);
    });

    it('registers with custom timeout', () => {
      const aggregator = new HealthAggregator();
      const checkFn = vi.fn();
      aggregator.register('slow-service', checkFn, { timeoutMs: 5000 });
      expect(aggregator._checks[0].timeoutMs).toBe(5000);
    });
  });

  describe('aggregate', () => {
    it('returns healthy when no checks are registered', async () => {
      const aggregator = new HealthAggregator();
      const result = await aggregator.aggregate();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.services).toEqual({});
      expect(result.summary.total).toBe(0);
    });

    it('returns healthy when all checks pass', async () => {
      const aggregator = new HealthAggregator();
      aggregator.register('service-a', async () => ({ status: HealthStatus.HEALTHY }));
      aggregator.register('service-b', async () => ({ status: HealthStatus.HEALTHY }));

      const result = await aggregator.aggregate();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.summary.healthy).toBe(2);
      expect(result.summary.total).toBe(2);
    });

    it('returns unhealthy when any critical check fails', async () => {
      const aggregator = new HealthAggregator();
      aggregator.register('service-ok', async () => ({ status: HealthStatus.HEALTHY }));
      aggregator.register('critical-bad', async () => {
        throw new Error('connection refused');
      }, { critical: true });

      const result = await aggregator.aggregate();
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('returns degraded when non-critical check fails', async () => {
      const aggregator = new HealthAggregator();
      aggregator.register('healthy-service', async () => ({ status: HealthStatus.HEALTHY }));
      aggregator.register('non-critical-bad', async () => {
        throw new Error('optional dependency down');
      }, { critical: false });

      const result = await aggregator.aggregate();
      expect(result.status).toBe(HealthStatus.DEGRADED);
    });

    it('returns degraded when all checks fail (non-critical)', async () => {
      const aggregator = new HealthAggregator();
      aggregator.register('bad-a', async () => {
        throw new Error('failed');
      });
      aggregator.register('bad-b', async () => {
        throw new Error('failed');
      });

      const result = await aggregator.aggregate();
      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.summary.unhealthy).toBe(2);
    });

    it('includes responseTime in result', async () => {
      const aggregator = new HealthAggregator();
      aggregator.register('service', async () => ({ status: HealthStatus.HEALTHY }));

      const result = await aggregator.aggregate();
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('includes process uptime in result', async () => {
      const aggregator = new HealthAggregator();
      const result = await aggregator.aggregate();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes version info in result', async () => {
      const aggregator = new HealthAggregator();
      const result = await aggregator.aggregate();
      expect(result.version).toBeDefined();
      expect(result.version.node).toBeTruthy();
    });

    it('includes memory info in result', async () => {
      const aggregator = new HealthAggregator();
      const result = await aggregator.aggregate();
      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeDefined();
    });
  });
});
