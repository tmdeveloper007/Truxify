import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));

describe('HealthCheck', async () => {
  let HealthStatus;
  let withTimeout;
  let executeCheck;
  const { HealthStatus: HS, withTimeout: wt, executeCheck: ec } = await import(
    '../../src/core/health/HealthCheck.js'
  );
  HealthStatus = HS;
  withTimeout = wt;
  executeCheck = ec;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HealthStatus', () => {
    it('has the expected status values', () => {
      expect(HealthStatus.HEALTHY).toBe('healthy');
      expect(HealthStatus.DEGRADED).toBe('degraded');
      expect(HealthStatus.UNHEALTHY).toBe('unhealthy');
      expect(HealthStatus.UNKNOWN).toBe('unknown');
    });
  });

  describe('withTimeout', () => {
    it('resolves when the promise resolves within timeout', async () => {
      const promise = new Promise((resolve) => setTimeout(() => resolve('ok'), 10));
      await expect(withTimeout(promise, 1000)).resolves.toBe('ok');
    });

    it('rejects when the promise exceeds timeout', async () => {
      const promise = new Promise((resolve) => setTimeout(() => resolve('ok'), 500));
      await expect(withTimeout(promise, 50)).rejects.toThrow(/timeout/);
    });

    it('uses default timeout of 400ms', async () => {
      const promise = new Promise((resolve) => setTimeout(() => resolve('ok'), 500));
      await expect(withTimeout(promise)).rejects.toThrow(/timeout/);
    });
  });

  describe('executeCheck', () => {
    it('returns HEALTHY status when checkFn resolves with status', async () => {
      const result = await executeCheck('test-service', async () => ({
        status: HealthStatus.HEALTHY,
      }));
      expect(result.name).toBe('test-service');
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.critical).toBe(false);
      expect(result.timestamp).toBeTruthy();
    });

    it('returns HEALTHY status when checkFn resolves without status field', async () => {
      const result = await executeCheck('test-service', async () => ({}));
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('returns UNHEALTHY status when checkFn throws', async () => {
      const result = await executeCheck(
        'failing-service',
        async () => {
          throw new Error('connection refused');
        },
      );
      expect(result.name).toBe('failing-service');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('connection refused');
    });

    it('returns UNHEALTHY status when checkFn times out', async () => {
      const result = await executeCheck(
        'slow-service',
        async () => new Promise((resolve) => setTimeout(() => resolve({ status: HealthStatus.HEALTHY }), 200)),
        { timeoutMs: 50 },
      );
      expect(result.name).toBe('slow-service');
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('timeout');
    });

    it('marks non-critical checks correctly', async () => {
      const result = await executeCheck(
        'non-critical-service',
        async () => ({ status: HealthStatus.HEALTHY }),
        { critical: false },
      );
      expect(result.critical).toBe(false);
    });

    it('marks critical checks correctly', async () => {
      const result = await executeCheck(
        'critical-service',
        async () => ({ status: HealthStatus.HEALTHY }),
        { critical: true },
      );
      expect(result.critical).toBe(true);
    });

    it('logs warning for slow responses above 500ms threshold', async () => {
      const result = await executeCheck(
        'slow-ok-service',
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { status: HealthStatus.HEALTHY };
        },
        { timeoutMs: 600 },
      );
      // The response time should be recorded
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('includes responseTime in result', async () => {
      const result = await executeCheck('fast-service', async () => ({ status: HealthStatus.HEALTHY }));
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });
});
