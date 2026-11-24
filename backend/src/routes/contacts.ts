import { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  addContact,
  listContacts,
  removeContact,
} from '../services/contact-service';
import { addContactSchema } from '../types/schemas';
import { AppError, ErrorCodes } from '../types/errors';
import { authMiddleware } from '../middleware/auth-middleware';
import logger from '../lib/logger';

const router = new Hono();

// All contact routes require auth
router.use('*', authMiddleware);

/**
 * Task 19: POST /capsules/:capsuleId/contacts
 */
router.post('/:capsuleId/contacts', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('capsuleId');
    const body = await c.req.json();

    const { email, name, passphrase } = addContactSchema.parse(body);

    const contact = await addContact(
      userId,
      capsuleId,
      email,
      name,
      passphrase
    );

    return c.json(
      {
        success: true,
        data: contact,
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

    logger.error(err, 'Add contact error');
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
 * Task 19: GET /capsules/:capsuleId/contacts
 */
router.get('/:capsuleId/contacts', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('capsuleId');

    const contacts = await listContacts(userId, capsuleId);

    return c.json({
      success: true,
      data: contacts,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'List contacts error');
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
 * Task 19: DELETE /capsules/:capsuleId/contacts/:contactId
 */
router.delete('/:capsuleId/contacts/:contactId', async (c) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (c as any).get('userId') as string;
    const capsuleId = c.req.param('capsuleId');
    const contactId = c.req.param('contactId');

    await removeContact(userId, capsuleId, contactId);

    return c.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }

    logger.error(err, 'Remove contact error');
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
