import { createHash, randomBytes } from 'crypto';

/**
 * Utility functions for cryptographic operations
 * Design.md: Security section
 */

/**
 * Generate a random token for one-time use links
 * Design.md: Property 3 - Single-use tokens (32-byte random)
 */
export function generateRandomToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * Design.md: Security - tokens hashed server-side
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate SHA-256 hash of arbitrary data
 * Design.md: Property 4 - Audit log tamper-evident chain
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate hash chain entry for audit log
 * Each entry hashes the previous hash + current data
 */
export function generateAuditHash(
  previousHash: string | null,
  data: Record<string, unknown>
): string {
  const dataString = JSON.stringify(data);
  const combined = previousHash ? previousHash + dataString : dataString;
  return sha256(combined);
}

/**
 * Generate IP hash for rate limiting and audit logging
 * Hash IP to avoid storing raw IPs
 */
export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Generate unique ID for database records
 */
export function generateId(): string {
  return randomBytes(16).toString('hex');
}
