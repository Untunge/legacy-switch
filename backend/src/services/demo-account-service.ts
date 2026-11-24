import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, capsules, timers, contacts } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  generateId,
  hashToken,
  generateRandomToken,
} from '../lib/crypto-utils';
import logger from '../lib/logger';
import { env } from '../lib/env';

/**
 * Demo Account Service
 * Task 43: Create demo account with pre-populated capsules
 * Design.md: Demo mode enables rapid testing with accelerated timers
 */

const DEMO_EMAIL = 'judge@demo.local';
const DEMO_PASSWORD = 'demo';
const DEMO_PASSPHRASE = 'demopass123';

/**
 * Calculate time for demo capsule based on DEMO_TIMER_MULTIPLIER
 * This allows accelerated timer progression (e.g., 1000x speed)
 */
function calculateDemoTime(minutesFromNow: number): Date {
  const multiplier = parseInt(env.DEMO_TIMER_MULTIPLIER, 10) || 1000;
  // Convert minutes to milliseconds, then divide by multiplier for acceleration
  const msAccelerated = (minutesFromNow * 60 * 1000) / multiplier;
  return new Date(Date.now() + msAccelerated);
}

/**
 * Demo content for capsules
 */
const DEMO_CAPSULE_1 = {
  title: 'Urgent: If Something Happens',
  description: 'Important information and instructions',
  content:
    'All my important accounts and passwords are stored in my password manager. The master password is in the safe. Here are the account names: Email, Banking, Investment Accounts. Contact my lawyer at lawyer@example.com. Instructions for handling my digital assets are in the cloud storage folder "Legacy".',
};

const DEMO_CAPSULE_2 = {
  title: 'My Digital Estate',
  description: 'Passwords and account information',
  content:
    'Bitcoin wallet seed phrase: abandon ability able about above absolute abuse access accident account accuse (sample, not real). Email accounts forwarding to: family@example.com. Social media accounts and usernames: @myhandle on Twitter, LinkedIn profile. Photos and memories stored in: Google Drive /My Drive/Photos. Final wishes: Donate to charity X, provide inheritance to family.',
};

const DEMO_CAPSULE_3 = {
  title: 'My Final Message',
  description: 'Personal message to loved ones',
  content:
    'Dear ones, if you are reading this, I am no longer here. I want you to know that I loved you deeply. Here are the things I need you to do: 1. Contact my employer to handle my affairs, 2. Access my insurance policy in the safe, 3. Take care of my pet - there is a fund set aside for care. My lawyer has copies of my will. Be well and take care of each other. - Your Name',
};

/**
 * Check if demo account already exists
 */
async function demoAccountExists(): Promise<boolean> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  return result.length > 0;
}

/**
 * Create a demo capsule with pre-encrypted content
 * Note: In production, content would be encrypted on the client side.
 * For the demo, we're storing a simplified representation.
 */
async function createDemoCapsule(
  userId: string,
  title: string,
  content: string,
  interval: 'day' | 'week' | 'month',
  timerState: 'active' | 'grace_period' | 'released',
  minutesUntilNextEvent: number,
  demoContactEmail?: string
): Promise<string> {
  const capsuleId = generateId();
  const now = new Date();

  // Create a simplified encrypted content representation
  // In real usage, this would be true AES-GCM encrypted content
  const encryptedContent = Buffer.from(content).toString('base64');
  const contentHash = Buffer.from(title + content).toString('hex');

  // Insert capsule
  await db.insert(capsules).values({
    id: capsuleId,
    userId,
    title,
    encryptedContent,
    contentHash,
    createdAt: now,
    updatedAt: now,
  });

  // Calculate timer dates based on demo multiplier
  let lastCheckinAt = now;
  let nextReleaseAt = calculateDemoTime(minutesUntilNextEvent);
  let graceEndsAt = null;

  if (timerState === 'grace_period') {
    // Grace period: last check-in was before the interval, next release is in grace period
    lastCheckinAt = new Date(now.getTime() - 11 * 60 * 1000); // 11 minutes ago (simulating interval passed)
    nextReleaseAt = new Date(now.getTime() - 1 * 60 * 1000); // Already past release time
    graceEndsAt = calculateDemoTime(1); // Grace ends in ~1 minute
  } else if (timerState === 'released') {
    // Released: timer already expired and grace period already passed
    lastCheckinAt = new Date(now.getTime() - 20 * 60 * 1000); // 20 minutes ago
    nextReleaseAt = new Date(now.getTime() - 10 * 60 * 1000); // Already released
    graceEndsAt = new Date(now.getTime() - 5 * 60 * 1000); // Grace period already ended
  }

  // Insert timer
  const timerId = generateId();
  await db.insert(timers).values({
    id: timerId,
    capsuleId,
    interval,
    lastCheckinAt,
    nextReleaseAt,
    graceEndsAt,
    status: timerState,
    createdAt: now,
  });

  // Add demo contact if specified
  if (demoContactEmail) {
    const contactId = generateId();
    const releaseToken = generateRandomToken();
    const releaseTokenHash = hashToken(releaseToken);
    const passphraseHash = await bcrypt.hash(DEMO_PASSPHRASE, 12);

    // Only mark as released if capsule is in released state
    const contacted = timerState === 'released';

    await db.insert(contacts).values({
      id: contactId,
      capsuleId,
      email: demoContactEmail,
      name: 'Demo Contact',
      releaseTokenHash,
      releaseTokenExpiry: null,
      passphraseHash,
      released: contacted,
      releasedAt: contacted
        ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        : null, // 2 days ago if released
      createdAt: now,
    });
  }

  logger.info({ capsuleId, title, timerState }, '[DEMO] Demo capsule created');

  return capsuleId;
}

/**
 * Initialize demo account with pre-populated capsules
 * Task 43: Called on backend startup if DEMO_MODE=true
 */
export async function initializeDemoAccount(): Promise<void> {
  if (!env.DEMO_MODE) {
    return;
  }

  // Check if demo account already exists
  const exists = await demoAccountExists();
  if (exists) {
    logger.info('[DEMO] Demo account already exists, skipping initialization');
    return;
  }

  try {
    // Create demo user account
    const userId = generateId();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      email: DEMO_EMAIL,
      passwordHash,
      createdAt: now,
    });

    logger.info({ email: DEMO_EMAIL }, '[DEMO] Demo user account created');

    // Create demo capsule 1 (ACTIVE - 50% through interval, 5 days ago)
    // With a weekly interval (7 days = 10080 minutes), 50% = 5040 minutes
    // We want it to show 50% remaining, so nextRelease should be ~5040 minutes from now
    await createDemoCapsule(
      userId,
      DEMO_CAPSULE_1.title,
      DEMO_CAPSULE_1.content,
      'week',
      'active',
      5040, // ~5 days remaining in demo (10080 / 2 / multiplier)
      'judge-contact-1@demo.local'
    );

    // Create demo capsule 2 (GRACE_PERIOD - 1 minute remaining)
    // Grace period is 7 days = 10080 minutes, so 1 minute remaining = 1 minute
    await createDemoCapsule(
      userId,
      DEMO_CAPSULE_2.title,
      DEMO_CAPSULE_2.content,
      'week',
      'grace_period',
      1, // Grace ends in ~1 minute
      'judge-contact-2@demo.local'
    );

    // Create demo capsule 3 (RELEASED - already accessed)
    await createDemoCapsule(
      userId,
      DEMO_CAPSULE_3.title,
      DEMO_CAPSULE_3.content,
      'week',
      'released',
      0,
      'judge-contact-3@demo.local'
    );

    logger.info(
      '[DEMO] Demo account initialized with 3 pre-populated capsules'
    );
    logger.info(
      `[DEMO] Login with email: ${DEMO_EMAIL}, password: ${DEMO_PASSWORD}`
    );
    logger.info(`[DEMO] Demo passphrase for all capsules: ${DEMO_PASSPHRASE}`);
  } catch (err) {
    logger.error(err, '[DEMO] Failed to initialize demo account');
    throw err;
  }
}
