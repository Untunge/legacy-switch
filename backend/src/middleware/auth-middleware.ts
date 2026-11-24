import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '../services/auth-service';
import { AppError, ErrorCodes } from '../types/errors';

/**
 * Authentication middleware
 * Validates JWT token from cookie and attaches user to context
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authMiddleware(c: Context, next: any) {
  const token = getCookie(c, 'session');

  if (!token) {
    throw new AppError(ErrorCodes.AUTH_TOKEN_INVALID, 'No session token', 401);
  }

  const payload = verifyJWT(token);
  c.set('userId', payload.userId);
  c.set('email', payload.email);
  await next();
}

/**
 * Optional auth middleware
 * Sets userId if token exists, continues otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function optionalAuthMiddleware(c: Context, next: any) {
  const token = getCookie(c, 'session');

  if (token) {
    try {
      const payload = verifyJWT(token);
      c.set('userId', payload.userId);
      c.set('email', payload.email);
    } catch (err) {
      // Token invalid, continue without auth
    }
  }

  await next();
}
