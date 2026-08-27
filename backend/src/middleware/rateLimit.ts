import { Request, Response, NextFunction } from 'express';
import { redis, checkRedisConnection } from '../redis.js';

interface MemoryRateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, MemoryRateLimitRecord>();

// Clean up stale memory records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 60000);

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  prefix?: string;
}

/**
 * Creates an Express rate-limiting middleware backed by Redis with in-memory fallback.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs = 60 * 1000, // 1 minute window
    max = 60,             // Max requests per window
    message = 'Too many requests, please try again later.',
    prefix = 'rl',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier (IP address)
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const clientKey = `${prefix}:${ip}`;

    try {
      const redisStatus = await checkRedisConnection();

      if (redisStatus.connected && redis) {
        // Redis-based sliding window rate limiter
        const currentCount = await redis.incr(clientKey);

        if (currentCount === 1) {
          // Set TTL on first request
          await redis.pexpire(clientKey, windowMs);
        }

        const ttlMs = await redis.pttl(clientKey);

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - currentCount));
        res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + Math.max(0, ttlMs)) / 1000));

        if (currentCount > max) {
          res.setHeader('Retry-After', Math.ceil(Math.max(1000, ttlMs) / 1000));
          res.status(429).json({
            error: message,
            retryAfterSeconds: Math.ceil(Math.max(1000, ttlMs) / 1000),
          });
          return;
        }

        next();
        return;
      }
    } catch {
      // Redis error -> fall back to memory store
    }

    // In-Memory Fallback
    const now = Date.now();
    let record = memoryStore.get(clientKey);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      memoryStore.set(clientKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const ttlMs = Math.max(0, record.resetTime - now);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil(ttlMs / 1000));
      res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil(ttlMs / 1000),
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters for key routes
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 login / auth attempts per minute
  message: 'Too many authentication attempts. Please wait 1 minute before trying again.',
  prefix: 'rl:auth',
});

export const twoFactorRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // 5 TOTP verify attempts per minute
  message: 'Too many 2FA verification attempts. Please wait 1 minute before trying again.',
  prefix: 'rl:2fa',
});

export const publicShareRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute
  message: 'Too many share access requests. Please try again shortly.',
  prefix: 'rl:share',
});

export const uploadBurstLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 chunk uploads per minute
  message: 'Upload rate limit exceeded. Please wait a moment.',
  prefix: 'rl:upload',
});
