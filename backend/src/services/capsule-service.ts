import { db } from '../db';
import { capsules, timers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError, ErrorCodes } from '../types/errors';
import { generateId } from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Capsule service
 * Design.md: Capsule CRUD with ownership verification, E2E encryption
 */

/**
 * Task 13: Create capsule
 */
export async function createCapsule(
  userId: string,
  title: string,
  encryptedContent: string,
  contentHash: string
): Promise<{
  id: string;
  title: string;
  createdAt: Date;
}> {
  const capsuleId = generateId();
  const now = new Date();

  await db.insert(capsules).values({
    id: capsuleId,
    userId,
    title,
    encryptedContent,
    contentHash,
    createdAt: now,
    updatedAt: now,
  });

  logger.info({ userId, capsuleId, title }, 'Capsule created');

  return {
    id: capsuleId,
    title,
    createdAt: now,
  };
}

/**
 * Get capsule by ID with ownership verification
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCapsule(
  userId: string,
  capsuleId: string
): Promise<any> {
  const result = await db
    .select()
    .from(capsules)
    .where(and(eq(capsules.id, capsuleId), eq(capsules.userId, userId)))
    .limit(1);

  if (result.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  return result[0];
}

/**
 * List all capsules for a user
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listCapsules(userId: string): Promise<any[]> {
  return db.select().from(capsules).where(eq(capsules.userId, userId));
}

/**
 * Task 13: Update capsule (reject updates after release)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCapsule(
  userId: string,
  capsuleId: string,
  updates: {
    title?: string;
    encryptedContent?: string;
    contentHash?: string;
  }
): Promise<any> {
  // Get capsule with ownership check
  const capsule = await getCapsule(userId, capsuleId);

  // Check if capsule is released (via timer status)
  const timerRow = await db
    .select()
    .from(timers)
    .where(eq(timers.capsuleId, capsuleId))
    .limit(1);

  if (timerRow.length > 0 && timerRow[0].status === 'released') {
    throw new AppError(
      ErrorCodes.CAPSULE_UNAUTHORIZED,
      'Cannot update a released capsule',
      403
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (updates.title !== undefined) {
    updateData.title = updates.title;
  }
  if (updates.encryptedContent !== undefined) {
    updateData.encryptedContent = updates.encryptedContent;
  }
  if (updates.contentHash !== undefined) {
    updateData.contentHash = updates.contentHash;
  }

  await db.update(capsules).set(updateData).where(eq(capsules.id, capsuleId));

  logger.info({ userId, capsuleId }, 'Capsule updated');

  return { ...capsule, ...updateData };
}

/**
 * Task 13: Delete capsule
 */
export async function deleteCapsule(
  userId: string,
  capsuleId: string
): Promise<void> {
  // Verify ownership
  await getCapsule(userId, capsuleId);

  await db.delete(capsules).where(eq(capsules.id, capsuleId));

  logger.info({ userId, capsuleId }, 'Capsule deleted');
}
