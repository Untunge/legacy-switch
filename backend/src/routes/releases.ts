import { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  validateReleaseLink,
  confirmReleaseAccess,
} from '../services/release-service';
import { releasePreviewSchema } from '../types/schemas';
import { AppError, ErrorCodes } from '../types/errors';
import logger from '../lib/logger';

const router = new Hono();

/**
 * Task 17: POST /releases/:capsuleId/preview
 * Get capsule preview with passphrase verification
 */
router.post('/:capsuleId/preview', async (c) => {
  try {
    const capsuleId = c.req.param('capsuleId');
    const body = await c.req.json();

    const { token, passphrase } = releasePreviewSchema.parse(body);

    const capsule = await validateReleaseLink(capsuleId, token, passphrase);

    return c.json({
      success: true,
      data: capsule,
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

    logger.error(err, 'Release preview error');
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
 * Task 18: POST /releases/:capsuleId/confirm
 * Mark release link as used (one-time use)
 */
router.post('/:capsuleId/confirm', async (c) => {
  try {
    const capsuleId = c.req.param('capsuleId');
    const body = await c.req.json();

    const { token } = releasePreviewSchema.parse(body);

    await confirmReleaseAccess(capsuleId, token);

    return c.json({ success: true });
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

    logger.error(err, 'Release confirm error');
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
