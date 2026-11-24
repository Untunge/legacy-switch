import { Context } from 'hono';
import { AppError, ErrorCodes } from '../types';
import logger from '../lib/logger';

/**
 * Error handling middleware
 * Design.md: Error Handling section
 */

export async function errorHandler(err: unknown, c: Context) {
  // Log the error
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode },
      `Application error: ${err.message}`
    );
    return c.json(err.toJSON(), err.statusCode);
  }

  if (err instanceof Error) {
    logger.error({ error: err.message }, 'Unhandled error');
    return c.json(
      {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'An internal error occurred',
      },
      500
    );
  }

  logger.error('Unknown error type');
  return c.json(
    {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'An internal error occurred',
    },
    500
  );
}

/**
 * Validation error helper
 */
export function validationError(details: Record<string, unknown>) {
  return new AppError(
    ErrorCodes.VALIDATION_ERROR,
    'Validation failed',
    400,
    details
  );
}
