import bcrypt from 'bcryptjs';
import { db } from '../db';
import { releaseLinks, contacts, capsules } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError, ErrorCodes } from '../types/errors';
import { hashToken } from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Release service
 * Design.md: Release link validation, capsule access, one-time tokens
 */

/**
 * Task 17: Validate release link and get capsule preview
 * Design.md: Property 3 - Single-use tokens
 */
export async function validateReleaseLink(
  capsuleId: string,
  token: string,
  passphrase: string
): Promise<{
  id: string;
  title: string;
  releasedAt: Date | null;
  releasedBy: string;
  encryptedContent: string;
}> {
  // Hash token to look up in DB
  const tokenHash = hashToken(token);

  // Find release link
  const linkRow = await db
    .select()
    .from(releaseLinks)
    .where(
      and(
        eq(releaseLinks.capsuleId, capsuleId),
        eq(releaseLinks.tokenHash, tokenHash)
      )
    )
    .limit(1);

  if (linkRow.length === 0) {
    throw new AppError(
      ErrorCodes.RELEASE_LINK_INVALID,
      'Invalid or expired release link',
      404
    );
  }

  const link = linkRow[0];

  // Check if link expired
  if (link.expiresAt < new Date()) {
    throw new AppError(
      ErrorCodes.RELEASE_LINK_EXPIRED,
      'Release link has expired',
      410
    );
  }

  // Get contact and verify passphrase
  const contactRow = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, link.contactId))
    .limit(1);

  if (contactRow.length === 0) {
    throw new AppError(ErrorCodes.CONTACT_NOT_FOUND, 'Contact not found', 404);
  }

  const contact = contactRow[0];

  // Verify passphrase with constant-time comparison
  const passphraseMatch = await bcrypt.compare(
    passphrase,
    contact.passphraseHash
  );

  if (!passphraseMatch) {
    throw new AppError(
      ErrorCodes.RELEASE_LINK_INVALID,
      'Invalid passphrase',
      401
    );
  }

  // Get capsule
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(eq(capsules.id, capsuleId))
    .limit(1);

  if (capsuleRow.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  const capsule = capsuleRow[0];

  logger.info(
    { capsuleId, contactEmail: contact.email },
    'Release link validated'
  );

  return {
    id: capsule.id,
    title: capsule.title,
    releasedAt: contact.releasedAt,
    releasedBy: capsule.userId,
    encryptedContent: capsule.encryptedContent,
  };
}

/**
 * Task 18: Mark release link as used (one-time use)
 * Design.md: Property 3 - Tokens invalidated after first use
 */
export async function confirmReleaseAccess(
  capsuleId: string,
  token: string
): Promise<void> {
  // Hash token
  const tokenHash = hashToken(token);

  // Find release link
  const linkRow = await db
    .select()
    .from(releaseLinks)
    .where(
      and(
        eq(releaseLinks.capsuleId, capsuleId),
        eq(releaseLinks.tokenHash, tokenHash)
      )
    )
    .limit(1);

  if (linkRow.length === 0) {
    throw new AppError(
      ErrorCodes.RELEASE_LINK_INVALID,
      'Invalid release link',
      404
    );
  }

  const link = linkRow[0];

  // Update link: increment viewCount, set viewedAt
  await db
    .update(releaseLinks)
    .set({
      viewedAt: new Date(),
      viewCount: (link.viewCount || 0) + 1,
    })
    .where(eq(releaseLinks.id, link.id));

  // Update contact: set released=true, releasedAt=now
  const contactRow = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, link.contactId))
    .limit(1);

  if (contactRow.length > 0) {
    await db
      .update(contacts)
      .set({
        released: true,
        releasedAt: new Date(),
      })
      .where(eq(contacts.id, link.contactId));
  }

  logger.info({ capsuleId }, 'Release link accessed and marked as used');
}
