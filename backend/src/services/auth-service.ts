import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, auditLog } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../lib/env';
import { AppError, ErrorCodes } from '../types/errors';
import { generateId, generateAuditHash } from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Authentication service
 * Design.md: User authentication, JWT, sessions
 */

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

type AuditAction =
  | 'login'
  | 'logout'
  | 'capsule_create'
  | 'capsule_update'
  | 'capsule_delete'
  | 'capsule_access'
  | 'checkin'
  | 'contact_add'
  | 'contact_remove'
  | 'release_trigger'
  | 'release_view';
type AuditResourceType = 'user' | 'capsule' | 'timer' | 'contact' | 'release';

/**
 * Task 9: User signup
 */
export async function signup(
  email: string,
  password: string,
  _ipHash: string
): Promise<{ userId: string; email: string; token: string }> {
  // Check if user exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(
      ErrorCodes.AUTH_USER_EXISTS,
      'User with this email already exists',
      409
    );
  }

  // Hash password with bcrypt (12+ rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const userId = generateId();
  const createdAt = new Date();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    createdAt,
  });

  // Log signup in audit log
  await logAuditEvent({
    userId,
    action: 'login',
    resourceType: 'user',
    resourceId: userId,
    details: { type: 'signup' },
  });

  // Generate JWT token
  const token = generateJWT(userId, email);

  logger.info({ userId, email }, 'User signed up');

  return { userId, email, token };
}

/**
 * Task 10: User login
 */
export async function login(
  email: string,
  password: string,
  _ipHash: string
): Promise<{ userId: string; email: string; token: string }> {
  // Find user by email
  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (userRow.length === 0) {
    // Generic error message to prevent email enumeration
    throw new AppError(
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password',
      401
    );
  }

  const user = userRow[0];

  // Verify password with constant-time comparison
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    throw new AppError(
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password',
      401
    );
  }

  // Log login in audit log
  await logAuditEvent({
    userId: user.id,
    action: 'login',
    resourceType: 'user',
    resourceId: user.id,
  });

  // Generate JWT token
  const token = generateJWT(user.id, user.email);

  logger.info({ userId: user.id, email: user.email }, 'User logged in');

  return { userId: user.id, email: user.email, token };
}

/**
 * Task 11: JWT token generation and validation
 */
export function generateJWT(userId: string, email: string): string {
  const expiryHours = parseInt(env.JWT_EXPIRY.replace('h', ''), 10) || 24;
  const expirySeconds = expiryHours * 3600;

  return jwt.sign({ userId, email } as JWTPayload, env.JWT_SECRET, {
    expiresIn: expirySeconds,
  });
}

export function verifyJWT(token: string): JWTPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (err) {
    if (err instanceof Error && err.message === 'jwt expired') {
      throw new AppError(
        ErrorCodes.AUTH_TOKEN_EXPIRED,
        'Token has expired',
        401
      );
    }
    throw new AppError(ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid token', 401);
  }
}

/**
 * Validate session and return user data
 */
export async function validateSession(
  token: string
): Promise<{ userId: string; email: string }> {
  const payload = verifyJWT(token);

  // Verify user still exists
  const userRow = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (userRow.length === 0) {
    throw new AppError(ErrorCodes.AUTH_USER_NOT_FOUND, 'User not found', 404);
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * Audit logging helper
 */
async function logAuditEvent(options: {
  userId?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  // Get previous audit log entry for hash chain
  const previousEntry = await db
    .select({ hashOfPrevious: auditLog.hashOfPrevious })
    .from(auditLog)
    .limit(1);

  const eventData = {
    action: options.action,
    ...(options.resourceType && { resourceType: options.resourceType }),
    ...(options.resourceId && { resourceId: options.resourceId }),
    ...(options.details && { ...options.details }),
  };

  const hashOfPrevious = previousEntry[0]?.hashOfPrevious || null;
  const hash = generateAuditHash(hashOfPrevious, eventData);

  const entryData = {
    id: generateId(),
    userId: options.userId || null,
    action: options.action as AuditAction,
    resourceType: (options.resourceType || null) as AuditResourceType | null,
    resourceId: options.resourceId || null,
    details: options.details || null,
    ipHash: null as string | null,
    hashOfPrevious: hash,
    timestamp: new Date(),
  };

  await db.insert(auditLog).values(entryData);
}
