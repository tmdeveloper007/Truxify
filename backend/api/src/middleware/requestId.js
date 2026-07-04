import { randomUUID } from 'crypto';
import logger from './logger.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.requestId = (typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming))
    ? incoming
    : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
}
