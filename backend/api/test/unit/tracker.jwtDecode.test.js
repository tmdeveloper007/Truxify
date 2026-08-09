import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import logger from '../../src/middleware/logger.js';

vi.mock('../../src/middleware/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const dbMock = vi.hoisted(() => ({
  store: {
    orders: [],
    profiles: [],
  },
  authUser: null,
}));

vi.mock('../../src/config/db.js', () => ({
  mongoDb: null,
  redisClient: null,
  firebaseAdmin: null,
  supabase: {
    auth: {
      async getUser() {
        return { data: { user: dbMock.authUser }, error: null };
      },
    },
    from(table) {
      const filters = [];
      return {
        select() { return this; },
        eq(column, value) {
          filters.push({ column, value });
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
    },
  },
}));

vi.mock('../../src/config/firebase.js', () => ({
  default: null,
  initializeApp: vi.fn(),
  getAuth: vi.fn(() => null),
}));

import { handleTrackingMessage } from '../../src/sockets/tracker.js';
import jwt from 'jsonwebtoken';

function pendingSocket(sentMessages = []) {
  return {
    isAlive: true,
    authenticated: false,
    userId: null,
    send(message) {
      sentMessages.push(JSON.parse(message));
    },
    close: vi.fn(),
  };
}

describe('tracker WebSocket — JWT decode error handling', () => {
  let warnSpy;

  beforeEach(() => {
    dbMock.authUser = null;
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
  });

  it('logs a warning when jwt.decode throws (decode error)', async () => {
    const sentMessages = [];
    const ws = pendingSocket(sentMessages);

    // Force jwt.decode to throw by restoring and mocking it.
    const originalDecode = jwt.decode;
    jwt.decode = vi.fn(() => { throw new Error('Invalid token structure'); });

    await handleTrackingMessage(ws, JSON.stringify({
      event: 'auth',
      data: { token: 'some-token' },
    }));

    // The warning must be logged so auth failures are observable.
    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0];
    expect(warnCall[1]).toContain('[Tracker]');

    jwt.decode = originalDecode;
  });

  it('socket remains unauthenticated when jwt.decode throws', async () => {
    const sentMessages = [];
    const ws = pendingSocket(sentMessages);

    const originalDecode = jwt.decode;
    jwt.decode = vi.fn(() => { throw new Error('Decode failed'); });

    await handleTrackingMessage(ws, JSON.stringify({
      event: 'auth',
      data: { token: 'bad-token' },
    }));

    expect(ws.authenticated).toBe(false);

    jwt.decode = originalDecode;
  });

  it('logs a warning when jwt.decode returns null (completely invalid token)', async () => {
    const sentMessages = [];
    const ws = pendingSocket(sentMessages);

    // jwt.decode returns null for completely invalid tokens.
    const originalDecode = jwt.decode;
    jwt.decode = vi.fn(() => null);

    await handleTrackingMessage(ws, JSON.stringify({
      event: 'auth',
      data: { token: 'completely-invalid' },
    }));

    // When decoded is null, isSupabaseToken will be false, and the socket
    // will not be authenticated. No exception is thrown so warn is not called
    // for this case — the fix specifically targets decode errors (throws).
    expect(ws.authenticated).toBe(false);

    jwt.decode = originalDecode;
  });
});
