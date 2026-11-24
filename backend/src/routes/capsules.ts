import { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  createCapsule,
  getCapsule,
  listCapsules,
  updateCapsule,
  deleteCapsule,
} from '../services/capsule-service';
import { initializeTimer } from '../services/timer-service';
import { getAuditLog } from '../services/audit-service';
import { createCapsuleSchema, updateCapsuleSchema } from '../types/schemas';
import { AppError, ErrorCodes } from '../types/errors';
import { authMiddleware } from '../middleware/auth-middleware';
import logger from '../lib/logger';

const router = new Hono();

// All capsule routes require auth
router.use('*', authMiddleware);

/**
 * Task 13: POST /capsules (create)
 */
router.post('/', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const body = await c.req.json();

    const { title, encryptedContent, contentHash } =
      createCapsuleSchema.parse(body);

    // Create capsule
    const capsule = await createCapsule(
      userId,
      title,
      encryptedContent,
      contentHash
    );

    // Initialize timer with default interval (day)
    await initializeTimer(capsule.id, 'day');

    return c.json(
      {
        success: true,
        data: capsule,
      },
      201
    );
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

    logger.error(err, 'Create capsule error');
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
 * Task 13: GET /capsules (list)
 */
router.get('/', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsules = await listCapsules(userId);

    return c.json({
      success: true,
      data: capsules,
    });
  } catch (err) {
    logger.error(err, 'List capsules error');
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
 * Task 13: GET /capsules/:id
 */
router.get('/:id', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('id');

    const capsule = await getCapsule(userId, capsuleId);

    return c.json({
      success: true,
      data: capsule,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Get capsule error');
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
 * Task 13: PUT /capsules/:id (update)
 */
router.put('/:id', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('id');
    const body = await c.req.json();

    const updates = updateCapsuleSchema.parse(body);

    const capsule = await updateCapsule(userId, capsuleId, updates);

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

    logger.error(err, 'Update capsule error');
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
 * Task 13: DELETE /capsules/:id
 */
router.delete('/:id', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('id');

    await deleteCapsule(userId, capsuleId);

    return c.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Delete capsule error');
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
 * Task 25: GET /capsules/:id/audit
 */
router.get('/:id/audit', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('id');

    // Verify ownership
    await getCapsule(userId, capsuleId);

    const auditLog = await getAuditLog(capsuleId);

    return c.json({
      success: true,
      data: auditLog,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Get audit log error');
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
