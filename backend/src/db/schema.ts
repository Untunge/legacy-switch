import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - stores user accounts with hashed passwords
 * Design.md: User authentication, sessions
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

/**
 * Capsules table - encrypted containers for personal legacy
 * Design.md: End-to-end encryption, content storage
 */
export const capsules = sqliteTable(
  'capsules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    encryptedContent: text('encrypted_content').notNull(),
    contentHash: text('content_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index('capsules_user_id_idx').on(table.userId),
  })
);

/**
 * Timers table - dead man's switch timer tracking
 * Design.md: Timer states (ACTIVE, GRACE_PERIOD, RELEASED)
 */
export const timers = sqliteTable(
  'timers',
  {
    id: text('id').primaryKey(),
    capsuleId: text('capsule_id')
      .notNull()
      .unique()
      .references(() => capsules.id, { onDelete: 'cascade' }),
    interval: text('interval', {
      enum: ['day', 'week', 'month'],
    }).notNull(),
    lastCheckinAt: integer('last_checkin_at', { mode: 'timestamp' }),
    nextReleaseAt: integer('next_release_at', { mode: 'timestamp' }).notNull(),
    graceEndsAt: integer('grace_ends_at', { mode: 'timestamp' }),
    status: text('status', {
      enum: ['active', 'grace_period', 'released'],
    })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    statusIdx: index('timers_status_idx').on(table.status),
    nextReleaseIdx: index('timers_next_release_idx').on(table.nextReleaseAt),
  })
);

/**
 * Contacts table - trusted contacts who can receive released capsules
 * Design.md: Per-capsule contact management, release notifications
 */
export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    capsuleId: text('capsule_id')
      .notNull()
      .references(() => capsules.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name'),
    releaseTokenHash: text('release_token_hash').notNull().unique(),
    releaseTokenExpiry: integer('release_token_expiry', { mode: 'timestamp' }),
    passphraseHash: text('passphrase_hash').notNull(),
    released: integer('released', { mode: 'boolean' }).notNull().default(false),
    releasedAt: integer('released_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    capsuleIdIdx: index('contacts_capsule_id_idx').on(table.capsuleId),
    tokenIdx: uniqueIndex('contacts_token_hash_idx').on(table.releaseTokenHash),
  })
);

/**
 * OneTimeTokens table - tracks single-use release link tokens
 * Design.md: Property 3 - Single-use tokens
 */
export const oneTimeTokens = sqliteTable(
  'one_time_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    used: integer('used', { mode: 'boolean' }).notNull().default(false),
    usedAt: integer('used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    usedIdx: index('one_time_tokens_used_idx').on(table.used),
    expiresIdx: index('one_time_tokens_expires_idx').on(table.expiresAt),
  })
);

/**
 * AuditLog table - immutable, append-only security event log
 * Design.md: Property 4 - Tamper-evident audit trail with hash chain
 */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action', {
      enum: [
        'login',
        'logout',
        'capsule_create',
        'capsule_update',
        'capsule_delete',
        'capsule_access',
        'checkin',
        'contact_add',
        'contact_remove',
        'release_trigger',
        'release_view',
      ],
    }).notNull(),
    resourceType: text('resource_type', {
      enum: ['user', 'capsule', 'timer', 'contact', 'release'],
    }),
    resourceId: text('resource_id'),
    details: text('details', { mode: 'json' }),
    ipHash: text('ip_hash'),
    hashOfPrevious: text('hash_of_previous'),
    timestamp: integer('timestamp', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index('audit_log_user_id_idx').on(table.userId),
    actionIdx: index('audit_log_action_idx').on(table.action),
    timestampIdx: index('audit_log_timestamp_idx').on(table.timestamp),
  })
);

/**
 * EmailQueue table - tracks transactional emails (warnings, releases)
 * Design.md: Email notifications at T-7, T-3 days
 */
export const emailQueue = sqliteTable(
  'email_queue',
  {
    id: text('id').primaryKey(),
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    bodyType: text('body_type', {
      enum: ['warning_7days', 'warning_3days', 'release_notification'],
    }).notNull(),
    bodyData: text('body_data', { mode: 'json' }).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sentIdx: index('email_queue_sent_idx').on(table.sentAt),
    toEmailIdx: index('email_queue_to_email_idx').on(table.toEmail),
  })
);

/**
 * ReleaseLinks table - tracks released capsules and access logs
 * Design.md: One-time-use release links
 */
export const releaseLinks = sqliteTable(
  'release_links',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    capsuleId: text('capsule_id')
      .notNull()
      .references(() => capsules.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    viewedAt: integer('viewed_at', { mode: 'timestamp' }),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    contactIdIdx: index('release_links_contact_id_idx').on(table.contactId),
    capsuleIdIdx: index('release_links_capsule_id_idx').on(table.capsuleId),
    tokenIdx: uniqueIndex('release_links_token_idx').on(table.token),
  })
);
