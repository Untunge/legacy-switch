import bcrypt from 'bcryptjs';
import { db } from '../db';
import { contacts, releaseLinks, capsules, emailQueue } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AppError, ErrorCodes } from '../types/errors';
import {
  generateId,
  generateRandomToken,
  hashToken,
} from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Contact service
 * Design.md: Contact management, release link generation, single-use tokens
 */

/**
 * Task 19: Add contact to capsule
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addContact(
  userId: string,
  capsuleId: string,
  email: string,
  name: string | undefined,
  passphrase: string
): Promise<any> {
  // Verify capsule ownership
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(and(eq(capsules.id, capsuleId), eq(capsules.userId, userId)))
    .limit(1);

  if (capsuleRow.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  // Hash passphrase with bcrypt
  const passphraseHash = await bcrypt.hash(passphrase, 12);

  // Generate release token
  const releaseToken = generateRandomToken();
  const releaseTokenHash = hashToken(releaseToken);

  const contactId = generateId();

  await db.insert(contacts).values({
    id: contactId,
    capsuleId,
    email,
    name: name || null,
    releaseTokenHash,
    releaseTokenExpiry: null,
    passphraseHash,
    released: false,
    releasedAt: null,
    createdAt: new Date(),
  });

  logger.info({ userId, capsuleId, email }, 'Contact added to capsule');

  return {
    id: contactId,
    email,
    name,
    released: false,
  };
}

/**
 * Task 19: List contacts for capsule
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listContacts(
  userId: string,
  capsuleId: string
): Promise<any[]> {
  // Verify capsule ownership
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(and(eq(capsules.id, capsuleId), eq(capsules.userId, userId)))
    .limit(1);

  if (capsuleRow.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  return db.select().from(contacts).where(eq(contacts.capsuleId, capsuleId));
}

/**
 * Task 19: Remove contact
 */
export async function removeContact(
  userId: string,
  capsuleId: string,
  contactId: string
): Promise<void> {
  // Verify capsule ownership
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(and(eq(capsules.id, capsuleId), eq(capsules.userId, userId)))
    .limit(1);

  if (capsuleRow.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  // Verify contact belongs to capsule
  const contactRow = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.capsuleId, capsuleId)))
    .limit(1);

  if (contactRow.length === 0) {
    throw new AppError(ErrorCodes.CONTACT_NOT_FOUND, 'Contact not found', 404);
  }

  await db.delete(contacts).where(eq(contacts.id, contactId));

  logger.info({ userId, capsuleId, contactId }, 'Contact removed');
}

/**
 * Task 16: Generate and send release links to contacts
 * Called when capsule is released
 */
export async function releaseToContacts(capsuleId: string): Promise<void> {
  // Get all contacts for capsule
  const capsuleContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.capsuleId, capsuleId));

  // Get capsule info
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(eq(capsules.id, capsuleId))
    .limit(1);

  if (capsuleRow.length === 0) return;

  for (const contact of capsuleContacts) {
    // Generate release link
    const token = generateRandomToken();
    const tokenHash = hashToken(token);

    const linkId = generateId();
    const releaseLinkExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(releaseLinks).values({
      id: linkId,
      contactId: contact.id,
      capsuleId,
      token,
      tokenHash,
      expiresAt: releaseLinkExpiry,
      viewedAt: null,
      viewCount: 0,
      createdAt: new Date(),
    });

    // Queue notification email
    await db.insert(emailQueue).values({
      id: generateId(),
      toEmail: contact.email,
      subject: 'Legacy information released',
      bodyType: 'release_notification',
      bodyData: {
        capsuleTitle: capsuleRow[0].title,
        releaseLink: `https://legacy-switch.local/releases/${capsuleId}?token=${token}`,
        expiresAt: releaseLinkExpiry.toISOString(),
      },
      sentAt: null,
      failureReason: null,
      retryCount: 0,
      createdAt: new Date(),
    });

    logger.info(
      { capsuleId, contactEmail: contact.email },
      'Release link generated and notification queued'
    );
  }
}
