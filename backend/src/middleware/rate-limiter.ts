import { Context } from 'hono';
import { AppError, ErrorCodes } from '../types/errors';
import { hashIP } from '../lib/crypto-utils';

/**
 * Rate limiting middleware
 * Design.md: Security - prevent brute-force on login, email bombardment
 */

// In-memory rate limit store (single-process only)
// TODO: Use Redis for multi-process deployments
const rateLimitStore: Record<string, Array<number>> = {};
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type MiddlewareFunction = (
  c: Context,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Rate limiter for login attempts
 * Design.md: 10 attempts / 15 min per IP
 */
export function rateLimitLogin(limit: number = 10): MiddlewareFunction {
  return async (c: Context, next: () => Promise<void>) => {
    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = hashIP(ip);

    // Get attempts in current window
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    if (!rateLimitStore[ipHash]) {
      rateLimitStore[ipHash] = [];
    }

    // Remove old attempts outside window
    rateLimitStore[ipHash] = rateLimitStore[ipHash].filter(
      (t) => t > windowStart
    );

    // Check if limit exceeded
    if (rateLimitStore[ipHash].length >= limit) {
      throw new AppError(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many login attempts. Try again later.',
        429
      );
    }

    // Record this attempt
    rateLimitStore[ipHash].push(now);

    await next();
  };
}

/**
 * Rate limiter for email sending
 * Design.md: 5 emails / hour per user
 */
export function rateLimitEmail(limit: number = 5): MiddlewareFunction {
  return async (c: Context, next: () => Promise<void>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId');
    if (!userId) {
      await next();
      return;
    }

    const key = `email:${userId}`;
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000; // 1 hour

    if (!rateLimitStore[key]) {
      rateLimitStore[key] = [];
    }

    // Remove old attempts
    rateLimitStore[key] = rateLimitStore[key].filter((t) => t > windowStart);

    if (rateLimitStore[key].length >= limit) {
      throw new AppError(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Too many emails. Try again later.',
        429
      );
    }

    rateLimitStore[key].push(now);

    await next();
  };
}

/**
 * Generic rate limiter
 */
export function rateLimitGeneric(
  key: string,
  limit: number,
  windowMs: number
): MiddlewareFunction {
  return async (_c: Context, next: () => Promise<void>) => {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitStore[key]) {
      rateLimitStore[key] = [];
    }

    rateLimitStore[key] = rateLimitStore[key].filter((t) => t > windowStart);

    if (rateLimitStore[key].length >= limit) {
      throw new AppError(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        429
      );
    }

    rateLimitStore[key].push(now);

    await next();
  };
}
