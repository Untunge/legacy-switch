import { Hono } from 'hono';
import { ZodError } from 'zod';
import { checkIn } from '../services/timer-service';
import { checkinSchema } from '../types/schemas';
import { AppError, ErrorCodes } from '../types/errors';
import { authMiddleware } from '../middleware/auth-middleware';
import logger from '../lib/logger';

const router = new Hono();

// Check-in requires auth
router.use('*', authMiddleware);

/**
 * Task 14: POST /checkin
 */
router.post('/', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const body = await c.req.json();

    const { capsuleId } = checkinSchema.parse(body);

    const result = await checkIn(userId, capsuleId);

    return c.json({
      success: true,
      data: {
        nextReleaseAt: result.nextReleaseAt,
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

    logger.error(err, 'Check-in error');
    return c.json(
      {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      500
    );
  }
});

export default router;
