/**
 * Domain types matching database schema
 * Design.md: Data Models section
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface Capsule {
  id: string;
  userId: string;
  title: string;
  encryptedContent: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DomainTimerInterval = 'day' | 'week' | 'month';
export type TimerStatus = 'active' | 'grace_period' | 'released';

export interface Timer {
  id: string;
  capsuleId: string;
  interval: DomainTimerInterval;
  lastCheckinAt: Date | null;
  nextReleaseAt: Date;
  graceEndsAt: Date | null;
  status: TimerStatus;
  createdAt: Date;
}

export interface Contact {
  id: string;
  capsuleId: string;
  email: string;
  name?: string;
  releaseTokenHash: string;
  releaseTokenExpiry: Date | null;
  passphraseHash: string;
  released: boolean;
  releasedAt: Date | null;
  createdAt: Date;
}

export type AuditAction =
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

export type AuditResourceType =
  'user' | 'capsule' | 'timer' | 'contact' | 'release';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipHash?: string;
  hashOfPrevious?: string;
  timestamp: Date;
}

export type EmailBodyType =
  'warning_7days' | 'warning_3days' | 'release_notification';

export interface EmailQueueItem {
  id: string;
  toEmail: string;
  subject: string;
  bodyType: EmailBodyType;
  bodyData: Record<string, unknown>;
  sentAt: Date | null;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}

export interface ReleaseLink {
  id: string;
  contactId: string;
  capsuleId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  viewedAt: Date | null;
  viewCount: number;
  createdAt: Date;
}

export interface OneTimeToken {
  tokenHash: string;
  used: boolean;
  usedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}
