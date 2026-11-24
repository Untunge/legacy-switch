import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { ZodError } from 'zod';
import { signup, login } from '../services/auth-service';
import { signupSchema, loginSchema } from '../types/schemas';
import { AppError, ErrorCodes } from '../types/errors';
import { rateLimitLogin } from '../middleware/rate-limiter';
import { authMiddleware } from '../middleware/auth-middleware';
import { hashIP } from '../lib/crypto-utils';
import logger from '../lib/logger';

const router = new Hono();

/**
 * Task 9: POST /auth/signup
 */
router.post('/signup', rateLimitLogin(5), async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = signupSchema.parse(body);

    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = hashIP(ip);

    const result = await signup(email, password, ipHash);

    // Set httpOnly cookie
    setCookie(c, 'session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return c.json({
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: err.errors,
        },
        400
      );
    }

    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Signup error');
    return c.json(
      {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      500
    );
  }
});

/**
 * Task 10: POST /auth/login
 */
router.post('/login', rateLimitLogin(10), async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = loginSchema.parse(body);

    const ip = c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = hashIP(ip);

    const result = await login(email, password, ipHash);

    // Set httpOnly cookie
    setCookie(c, 'session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return c.json({
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json(
        {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: err.errors,
        },
        400
      );
    }

    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Login error');
    return c.json(
      {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      500
    );
  }
});

/**
 * Task 11: GET /auth/session
 * Validate current session
 */
router.get('/session', authMiddleware, async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const email = (c as any).get('email') as string;

    return c.json({
      success: true,
      data: {
        userId,
        email,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    return c.json(
      {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      500
    );
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (c) => {
  deleteCookie(c, 'session');
  return c.json({ success: true });
});

export default router;
