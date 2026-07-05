/**
 * Unit tests for backend/api/src/services/escrowRefundReconciliation.js
 *
 * Run with:  npm run test:unit -- test/unit/escrowRefundReconciliation.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mocks created with vi.hoisted so they are available at vi.mock hoisting time
const mockConfirmEscrowRefund = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockRedisClient = vi.hoisted(() => ({
  set: vi.fn(),
  del: vi.fn(),
}));

const mockAcquireLock = vi.hoisted(() => vi.fn());
const mockReleaseLock = vi.hoisted(() => vi.fn());

const mockSupabaseFrom = vi.hoisted(() => vi.fn());
const mockSupabaseRpc = vi.hoisted(() => vi.fn());
const mockSupabase = vi.hoisted(() => ({ from: mockSupabaseFrom, rpc: mockSupabaseRpc }));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/services/escrow.js', () => ({
  confirmEscrowRefund: mockConfirmEscrowRefund,
}));

vi.mock('../../src/config/db.js', () => ({
  supabase: mockSupabase,
  redisClient: mockRedisClient,
}));

vi.mock('../../src/lib/redisLock.js', () => ({
  acquireLock: mockAcquireLock,
  releaseLock: mockReleaseLock,
}));

vi.mock('os', () => ({
  default: { hostname: () => 'test-host' },
}));

import {
  reconcilePendingEscrowRefunds,
  startEscrowRefundReconciliation,
  stopEscrowRefundReconciliation,
} from '../../src/services/escrowRefundReconciliation.js';

// Query builder helpers
function pendingQBuilder(orders) {
  const limit = vi.fn(() => Promise.resolve({ data: orders, error: null }));
  const not = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ not }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, not, limit };
}

function updateBuilder() {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq };
}

function maybeSingleBuilder(data) {
  const maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

describe('escrowRefundReconciliation', () => {
  beforeEach(() => {
    // Reset call history for all mocks
    mockSupabaseFrom.mockReset();
    mockSupabaseRpc.mockReset();
    mockConfirmEscrowRefund.mockReset();
    mockRedisClient.set.mockReset();
    mockRedisClient.del.mockReset();
    mockAcquireLock.mockReset();
    mockReleaseLock.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    // Default: empty pending orders
    mockSupabaseFrom.mockReturnValue(pendingQBuilder([]));
    mockSupabaseRpc.mockReturnValue(Promise.resolve({ data: [{ id: 'claimed' }], error: null }));
  });

  // Set up a sequence of from() return values (each call gets the next builder)
  // First call = pending orders query (most tests only need 1 call)
  // Second call = update or maybeSingle (for tests that exercise per-order path)
  function setupFromSequence(...builders) {
    builders.forEach(qb => mockSupabaseFrom.mockImplementationOnce(() => qb));
  }

  it('skips batch when global lock is held by another instance', async () => {
    mockRedisClient.set.mockResolvedValueOnce(null);
    // Default from() returns empty pending orders from beforeEach

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[escrow-reconciliation] Global lock held by another instance, skipping batch pull.'
    );
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('handles empty pending queue gracefully', async () => {
    mockRedisClient.set.mockResolvedValueOnce('lock-value');
    // Default from() returns empty pending orders from beforeEach
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockRedisClient.del).toHaveBeenCalledWith('escrow:reconciliation:lock');
  });

  it('processes a single pending order successfully', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockAcquireLock.mockResolvedValueOnce('per-order-lock');
    // First from() = pending orders query; second from() = update query
    setupFromSequence(
      pendingQBuilder([{ id: 'order-1', order_display_id: 'ORD-001', refund_tx_hash: '0xabc123' }]),
      updateBuilder()
    );
    mockSupabaseRpc.mockResolvedValueOnce({ data: [{ id: 'claimed-1' }], error: null });
    mockReleaseLock.mockResolvedValueOnce();
    mockConfirmEscrowRefund.mockResolvedValueOnce({ hash: '0xdef456' });
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockAcquireLock).toHaveBeenCalledWith('escrow_lock:order-1', 30000);
    expect(mockConfirmEscrowRefund).toHaveBeenCalledWith('0xabc123');
    expect(mockReleaseLock).toHaveBeenCalledWith('escrow_lock:order-1', 'per-order-lock');
    expect(mockRedisClient.del).toHaveBeenCalledWith('escrow:reconciliation:lock');
  });

  it('skips already-claimed orders (RPC returns empty claim)', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockSupabaseFrom.mockReturnValue(
      pendingQBuilder([{ id: 'order-2', order_display_id: 'ORD-002', refund_tx_hash: '0xtx2' }])
    );
    mockAcquireLock.mockResolvedValueOnce('lock-val');
    mockReleaseLock.mockResolvedValueOnce();
    mockSupabaseRpc.mockResolvedValueOnce({ data: [], error: null });

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[escrow-reconciliation] Order ORD-002 already claimed by another instance, skipping.'
    );
    expect(mockConfirmEscrowRefund).not.toHaveBeenCalled();
    expect(mockReleaseLock).toHaveBeenCalled();
  });

  it('skips orders no longer in refund_pending status', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockAcquireLock.mockResolvedValueOnce('lock-val');
    setupFromSequence(
      pendingQBuilder([{ id: 'order-3', order_display_id: 'ORD-003', refund_tx_hash: '0xtx3' }]),
      maybeSingleBuilder({ escrow_status: 'refunded', reconciled_by: 'other-instance' })
    );
    mockReleaseLock.mockResolvedValueOnce();
    // RPC errors — triggers secondary order lookup
    mockSupabaseRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not pending' },
    });

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[escrow-reconciliation] Order ORD-003 already processed, skipping.'
    );
    expect(mockConfirmEscrowRefund).not.toHaveBeenCalled();
  });

  it('logs blockchain confirmation failure and releases locks', async () => {
    // Execution order in service: redisClient.set → acquireLock → from() → rpc → from() → confirmEscrowRefund
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockAcquireLock.mockResolvedValueOnce('order4-lock');
    setupFromSequence(
      pendingQBuilder([{ id: 'order-4', order_display_id: 'ORD-004', refund_tx_hash: '0xtx4' }]),
      maybeSingleBuilder({ escrow_status: 'refund_pending' })
    );
    mockSupabaseRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not pending' },
    });
    mockConfirmEscrowRefund.mockRejectedValueOnce(new Error('RPC timeout'));
    mockReleaseLock.mockResolvedValueOnce();
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[escrow-reconciliation] Refund for ORD-004 is not confirmed yet:',
      'RPC timeout'
    );
    expect(mockReleaseLock).toHaveBeenCalledWith('escrow_lock:order-4', 'order4-lock');
    expect(mockRedisClient.del).toHaveBeenCalled();
  });

  it('releases per-order locks even on blockchain failure', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockAcquireLock.mockResolvedValueOnce('order5-lock');
    setupFromSequence(
      pendingQBuilder([{ id: 'order-5', order_display_id: 'ORD-005', refund_tx_hash: '0xtx5' }]),
      maybeSingleBuilder({ escrow_status: 'refunded' })
    );
    mockReleaseLock.mockResolvedValueOnce();
    mockSupabaseRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not pending' },
    });
    mockConfirmEscrowRefund.mockRejectedValueOnce(new Error('network failure'));
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockReleaseLock).toHaveBeenCalledWith('escrow_lock:order-5', 'order5-lock');
    expect(mockRedisClient.del).toHaveBeenCalled();
  });

  it('releases global lock after processing', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockSupabaseFrom.mockReturnValue(pendingQBuilder([]));
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockRedisClient.del).toHaveBeenCalledWith('escrow:reconciliation:lock');
  });

  it('logs error and returns early when pending orders query fails', async () => {
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    const errorQb = pendingQBuilder(null);
    errorQb.limit.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'DB error' } })
    );
    // Override first from() to return error builder
    mockSupabaseFrom.mockReturnValueOnce(errorQb);

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[escrow-reconciliation] Failed to load pending refunds:',
      'DB error'
    );
    // redisClient.del is after the for-loop, so early return skips it
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('logs error when order update fails but still releases per-order lock', async () => {
    // Execution order: redisClient.set → acquireLock → from(pending) → rpc → confirmEscrowRefund → from(update)
    const errorUpdateQb = updateBuilder();
    // Update query calls .eq() TWICE: .eq('id').eq('escrow_status')
    // First eq() must return an object with a second eq(), second eq() returns the error
    errorUpdateQb.eq
      .mockReturnValueOnce({ eq: vi.fn(() => Promise.resolve({ error: { message: 'update failed' } })) })
      .mockReturnValueOnce(Promise.resolve({ error: { message: 'update failed' } }));
    // Reset and chain from() calls: first = pending orders, second = error update builder
    mockSupabaseFrom.mockReset();
    mockSupabaseFrom
      .mockImplementationOnce(() => pendingQBuilder([{ id: 'order-6', order_display_id: 'ORD-006', refund_tx_hash: '0xtx6' }]))
      .mockImplementationOnce(() => errorUpdateQb);
    mockRedisClient.set.mockResolvedValueOnce('global-lock');
    mockAcquireLock.mockResolvedValueOnce('order6-lock'); // global lock
    mockAcquireLock.mockResolvedValueOnce('order6-lock'); // per-order lock
    mockSupabaseRpc.mockResolvedValueOnce({ data: [{ id: 'claimed' }], error: null });
    mockConfirmEscrowRefund.mockResolvedValueOnce({ hash: '0xh' });
    mockReleaseLock.mockResolvedValueOnce();
    mockRedisClient.del.mockResolvedValueOnce();

    await reconcilePendingEscrowRefunds();

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[escrow-reconciliation] Failed to finalize refund for ORD-006:',
      'update failed'
    );
    expect(mockReleaseLock).toHaveBeenCalled();
  });

  describe('startEscrowRefundReconciliation / stopEscrowRefundReconciliation', () => {
    it('starts and stops the reconciliation timer without throwing', () => {
      vi.useFakeTimers();
      try {
        startEscrowRefundReconciliation();
        stopEscrowRefundReconciliation();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
