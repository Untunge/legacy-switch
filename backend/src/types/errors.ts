/**
 * Standard error response format
 * Design.md: Error Handling section
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Common error codes
export const ErrorCodes = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_USER_EXISTS: 'AUTH_USER_EXISTS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  CAPSULE_NOT_FOUND: 'CAPSULE_NOT_FOUND',
  CAPSULE_UNAUTHORIZED: 'CAPSULE_UNAUTHORIZED',
  TIMER_NOT_FOUND: 'TIMER_NOT_FOUND',
  CONTACT_NOT_FOUND: 'CONTACT_NOT_FOUND',
  RELEASE_LINK_INVALID: 'RELEASE_LINK_INVALID',
  RELEASE_LINK_EXPIRED: 'RELEASE_LINK_EXPIRED',
  RELEASE_NOT_AVAILABLE: 'RELEASE_NOT_AVAILABLE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;
