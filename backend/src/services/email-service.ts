import { db } from '../db';
import { emailQueue } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { env } from '../lib/env';
import logger from '../lib/logger';

/**
 * Email service
 * Design.md: Transactional email, retry with backoff, Resend API or console
 */

/**
 * Task 20: Send queued emails
 * Implements retry with exponential backoff
 */
export async function processEmailQueue(): Promise<void> {
  // Get unsent emails
  const unsent = await db
    .select()
    .from(emailQueue)
    .where(isNull(emailQueue.sentAt));

  for (const email of unsent) {
    try {
      // Check retry backoff: 2^retryCount minutes
      const minAge = Math.pow(2, email.retryCount) * 60 * 1000;
      const ageMs = Date.now() - email.createdAt.getTime();

      if (ageMs < minAge) {
        continue; // Not ready to retry yet
      }

      // Max 5 retries
      if (email.retryCount >= 5) {
        await db
          .update(emailQueue)
          .set({
            failureReason: 'Max retries exceeded',
            sentAt: new Date(),
          })
          .where(eq(emailQueue.id, email.id));
        continue;
      }

      // Send email
      await sendEmail(email);

      // Mark as sent
      await db
        .update(emailQueue)
        .set({ sentAt: new Date() })
        .where(eq(emailQueue.id, email.id));

      logger.info({ to: email.toEmail }, 'Email sent');
    } catch (err) {
      // Increment retry count
      await db
        .update(emailQueue)
        .set({
          retryCount: email.retryCount + 1,
          failureReason: err instanceof Error ? err.message : 'Unknown error',
        })
        .where(eq(emailQueue.id, email.id));

      logger.warn(
        { to: email.toEmail, error: err },
        'Email send failed, will retry'
      );
    }
  }
}

/**
 * Send a single email via Resend or console (demo)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendEmail(email: any): Promise<void> {
  if (env.DEMO_MODE) {
    // Console logging in demo mode
    logger.info(
      {
        to: email.toEmail,
        subject: email.subject,
        body: email.bodyData,
      },
      '[DEMO] Email would be sent'
    );
    return;
  }

  if (!env.RESEND_API_KEY) {
    logger.warn(
      { to: email.toEmail },
      'No RESEND_API_KEY configured, skipping email'
    );
    return;
  }

  // TODO: Implement Resend API integration
  // For now, just log
  logger.info(
    { to: email.toEmail, subject: email.subject },
    'Email would be sent via Resend'
  );
}

/**
 * Background job runner (call every 5 minutes)
 */
export async function runEmailJobs(): Promise<void> {
  try {
    await processEmailQueue();
  } catch (err) {
    logger.error(err, 'Error running email jobs');
  }
}
