import { db } from '../db';
import { timers, capsules, emailQueue, users } from '../db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { AppError, ErrorCodes } from '../types/errors';
import { generateId } from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Timer service
 * Design.md: Timer state machine, check-in, grace period, release
 */

export type TimerInterval = 'day' | 'week' | 'month';
export type TimerStatus = 'active' | 'grace_period' | 'released';

const GRACE_PERIOD_DAYS = 7;

function getIntervalMs(interval: TimerInterval): number {
  switch (interval) {
    case 'day':
      return 24 * 60 * 60 * 1000;
    case 'week':
      return 7 * 24 * 60 * 60 * 1000;
    case 'month':
      return 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Task 14: Initialize timer for new capsule
 */
export async function initializeTimer(
  capsuleId: string,
  interval: TimerInterval
): Promise<any> {
  const timerId = generateId();
  const now = new Date();
  const nextReleaseAt = new Date(now.getTime() + getIntervalMs(interval));

  await db.insert(timers).values({
    id: timerId,
    capsuleId,
    interval,
    lastCheckinAt: now,
    nextReleaseAt,
    graceEndsAt: null,
    status: 'active',
    createdAt: now,
  });

  logger.info({ capsuleId, interval, nextReleaseAt }, 'Timer initialized');

  return {
    id: timerId,
    capsuleId,
    interval,
    nextReleaseAt,
    status: 'active',
  };
}

/**
 * Task 14: Get timer status
 */
export async function getTimerStatus(capsuleId: string): Promise<any> {
  const result = await db
    .select()
    .from(timers)
    .where(eq(timers.capsuleId, capsuleId))
    .limit(1);

  if (result.length === 0) {
    throw new AppError(ErrorCodes.TIMER_NOT_FOUND, 'Timer not found', 404);
  }

  return result[0];
}

/**
 * Task 14: Check-in endpoint
 * Design.md: Property 5 - Check-in extends timer by exact interval
 */
export async function checkIn(
  userId: string,
  capsuleId: string
): Promise<{ nextReleaseAt: Date }> {
  // Verify ownership
  const capsuleRow = await db
    .select()
    .from(capsules)
    .where(and(eq(capsules.id, capsuleId), eq(capsules.userId, userId)))
    .limit(1);

  if (capsuleRow.length === 0) {
    throw new AppError(ErrorCodes.CAPSULE_NOT_FOUND, 'Capsule not found', 404);
  }

  // Get timer
  const timerRow = await db
    .select()
    .from(timers)
    .where(eq(timers.capsuleId, capsuleId))
    .limit(1);

  if (timerRow.length === 0) {
    throw new AppError(ErrorCodes.TIMER_NOT_FOUND, 'Timer not found', 404);
  }

  const timer = timerRow[0];

  // If released, cannot check in
  if (timer.status === 'released') {
    throw new AppError(
      ErrorCodes.TIMER_NOT_FOUND,
      'Cannot check in on a released capsule',
      400
    );
  }

  const now = new Date();
  const nextReleaseAt = new Date(now.getTime() + getIntervalMs(timer.interval));

  // Update timer: extend nextRelease, reset graceEndsAt, return to ACTIVE
  await db
    .update(timers)
    .set({
      lastCheckinAt: now,
      nextReleaseAt,
      graceEndsAt: null,
      status: 'active',
    })
    .where(eq(timers.id, timer.id));

  logger.info({ userId, capsuleId, nextReleaseAt }, 'Check-in successful');

  return { nextReleaseAt };
}

/**
 * Task 15: Check for expired timers (background job)
 * Transitions ACTIVE → GRACE_PERIOD, sends 7-day warning
 */
export async function checkExpiredTimers(): Promise<void> {
  const now = new Date();

  // Find ACTIVE timers past nextReleaseAt
  const expiredTimers = await db
    .select()
    .from(timers)
    .where(and(eq(timers.status, 'active'), lte(timers.nextReleaseAt, now)));

  for (const timer of expiredTimers) {
    const graceEndsAt = new Date(
      now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    // Transition to GRACE_PERIOD
    await db
      .update(timers)
      .set({
        status: 'grace_period',
        graceEndsAt,
      })
      .where(eq(timers.id, timer.id));

    // Queue warning email
    await queueWarningEmail(timer.capsuleId, 7);

    logger.info(
      { capsuleId: timer.capsuleId, graceEndsAt },
      'Timer entered grace period'
    );
  }
}

/**
 * Task 16: Check for grace period expiration and release
 * Transitions GRACE_PERIOD → RELEASED, sends release emails
 */
export async function checkGracePeriodExpired(): Promise<void> {
  const now = new Date();

  // Find GRACE_PERIOD timers past graceEndsAt
  const expiredGracePeriods = await db
    .select()
    .from(timers)
    .where(
      and(eq(timers.status, 'grace_period'), lte(timers.graceEndsAt, now))
    );

  for (const timer of expiredGracePeriods) {
    // Transition to RELEASED
    await db
      .update(timers)
      .set({
        status: 'released',
      })
      .where(eq(timers.id, timer.id));

    // Queue release emails (will be sent by ContactService)
    await queueReleaseNotificationEmail(timer.capsuleId);

    logger.info(
      { capsuleId: timer.capsuleId },
      'Capsule released - contacts notified'
    );
  }
}

/**
 * Queue warning email for user
 */
async function queueWarningEmail(
  capsuleId: string,
  daysRemaining: number
): Promise<void> {
  // Get capsule with owner info
  const capsuleRow = await db
    .select({ userId: capsules.userId, title: capsules.title })
    .from(capsules)
    .where(eq(capsules.id, capsuleId))
    .limit(1);

  if (capsuleRow.length === 0) return;

  // Get user email
  const userRow = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, capsuleRow[0].userId))
    .limit(1);

  if (userRow.length === 0) return;

  const bodyType = daysRemaining === 7 ? 'warning_7days' : 'warning_3days';

  await db.insert(emailQueue).values({
    id: generateId(),
    toEmail: userRow[0].email,
    subject: `Legacy Switch: Your capsule will release in ${daysRemaining} days`,
    bodyType,
    bodyData: {
      capsuleTitle: capsuleRow[0].title,
      daysRemaining,
      checkInUrl: 'https://legacy-switch.local/dashboard',
    },
    sentAt: null,
    failureReason: null,
    retryCount: 0,
    createdAt: new Date(),
  });
}

/**
 * Queue release notification email
 */
async function queueReleaseNotificationEmail(capsuleId: string): Promise<void> {
  // This will be called by ContactService when generating release links
  logger.info(
    { capsuleId },
    'Release notification will be queued by ContactService'
  );
}

/**
 * Background job runner (call every 60s)
 */
export async function runTimerJobs(): Promise<void> {
  try {
    await checkExpiredTimers();
    await checkGracePeriodExpired();
  } catch (err) {
    logger.error(err, 'Error running timer jobs');
  }
}
