import { db } from '../db';
import { auditLog } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateId, generateAuditHash } from '../lib/crypto-utils';
import logger from '../lib/logger';

/**
 * Audit service
 * Design.md: Property 4 - Tamper-evident audit log with hash chain
 */

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

export interface AuditEvent {
  userId?: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  ipHash?: string;
  details?: Record<string, unknown>;
}

/**
 * Task 24: Log audit event with hash chain
 */
export async function logEvent(event: AuditEvent): Promise<void> {
  // Get previous audit entry for hash chain
  const previousEntries = await db
    .select({ hashOfPrevious: auditLog.hashOfPrevious })
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(1);

  const previousHash = previousEntries[0]?.hashOfPrevious || null;

  // Generate hash for this event
  const eventData: Record<string, unknown> = {
    action: event.action,
    ...(event.resourceType && { resourceType: event.resourceType }),
    ...(event.resourceId && { resourceId: event.resourceId }),
    ...(event.details && event.details),
  };

  const hash = generateAuditHash(previousHash, eventData);

  // Insert audit log entry
  const entryData = {
    id: generateId(),
    userId: event.userId || null,
    action: event.action as AuditAction,
    resourceType: (event.resourceType || null) as AuditResourceType | null,
    resourceId: event.resourceId || null,
    details: event.details || null,
    ipHash: event.ipHash || null,
    hashOfPrevious: hash,
    timestamp: new Date(),
  };

  await db.insert(auditLog).values(entryData);
}

/**
 * Task 25: Get audit log for capsule
 * Returns entries with tamper detection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAuditLog(capsuleId: string): Promise<any[]> {
  // Get all audit entries for capsule
  const entries = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.resourceId, capsuleId));

  // Verify hash chain integrity
  let previousHash: string | null = null;
  const result = entries.map((entry) => {
    // Recompute expected hash
    const eventData: Record<string, unknown> = {
      action: entry.action,
    };
    if (entry.resourceType) {
      eventData.resourceType = entry.resourceType;
    }
    if (entry.resourceId) {
      eventData.resourceId = entry.resourceId;
    }
    if (entry.details) {
      Object.assign(eventData, entry.details);
    }

    const expectedHash = generateAuditHash(previousHash, eventData);

    // Tamper detected if hashes don't match
    const tampered = entry.hashOfPrevious !== expectedHash;

    if (tampered) {
      logger.error(
        { capsuleId, entryId: entry.id },
        'Audit log tampering detected!'
      );
    }

    previousHash = entry.hashOfPrevious;

    return { ...entry, tampered };
  });

  return result;
}

/**
 * Verify audit log integrity
 * Returns true if chain is valid
 */
export async function verifyAuditLogIntegrity(
  capsuleId: string
): Promise<boolean> {
  const entries = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.resourceId, capsuleId));

  let previousHash: string | null = null;
  for (const entry of entries) {
    const eventData: Record<string, unknown> = {
      action: entry.action,
    };
    if (entry.resourceType) {
      eventData.resourceType = entry.resourceType;
    }
    if (entry.resourceId) {
      eventData.resourceId = entry.resourceId;
    }
    if (entry.details) {
      Object.assign(eventData, entry.details);
    }

    const expectedHash = generateAuditHash(previousHash, eventData);

    if (entry.hashOfPrevious !== expectedHash) {
      return false;
    }

    previousHash = entry.hashOfPrevious;
  }

  return true;
}
