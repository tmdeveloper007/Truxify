import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/db.js';
import logger from './logger.js';

function isRedisReady() {
  return redisClient && redisClient.status === 'ready';
}

function buildStore(prefix) {
  if (!isRedisReady()) {
    logger.warn('Redis unavailable. Falling back to memory rate limiter.');
    return undefined;
  }
  return new RedisStore({
    prefix,
    sendCommand: (command, ...args) => redisClient.call(command, ...args),
  });
}

/**
 * Keys a limiter by the authenticated principal, falling back to the client IP
 * for unauthenticated requests. Used wherever req.user is available so that
 * users sharing a public IP (e.g. mobile clients behind carrier-grade NAT) are
 * limited independently rather than against one shared bucket.
 */
export function userKeyGenerator(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  if (req.user?.uid) return `uid:${req.user.uid}`;
  return ipKeyGenerator(req);
}

// Coarse, pre-auth IP limiter. It runs before authentication, so it can only
// key by IP; kept generous so that legitimate users sharing a NAT'd IP are not
// throttled by each other. Per-user fairness is enforced by userLimiter once
// the request is authenticated.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('rl:global:'),
  message: { error: 'Rate limit exceeded', retryAfter: 900 },
  skip: (req) => req.path === '/health' || req.path.startsWith('/health/'),
});

// Per-user limiter, applied in the route chains immediately after the
// authenticate middleware so req.user is populated and each user gets an
// independent bucket regardless of shared IPs.
export const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  store: buildStore('rl:user:'),
  message: { error: 'Rate limit exceeded', retryAfter: 900 },
});

export const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('rl:health:'),
  message: { error: 'Rate limit exceeded', retryAfter: 60 },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('rl:auth:'),
  message: { error: 'Rate limit exceeded', retryAfter: 3600 },
});

export const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  store: buildStore('rl:bid:'),
  message: { error: 'Rate limit exceeded', retryAfter: 60 },
});
