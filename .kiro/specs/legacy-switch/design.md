# Design Document: Legacy Switch

## Overview

Legacy Switch is a full-stack web application implementing a digital dead man's switch for personal legacy information. The system prioritizes end-to-end encryption (AES-GCM in the browser), timer-based automatic release with grace periods, and immutable audit logging with tamper-evident hash chains. The architecture separates frontend (React on Vercel) from backend (Node.js on Fly.io/Render), communicates via REST APIs over HTTPS with JWT authentication, and uses a relational database (PostgreSQL) with Drizzle ORM for type-safe schema management.

The design ensures that the server never has access to plaintext capsule contents, encrypted contact passphrases, or user passwords. All cryptographic operations occur in the browser using WebCrypto API. Demo mode (1000x timer acceleration) enables rapid testing and demonstration without waiting for real time intervals.

---

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            User Browsers (HTTPS)                             │
├────────────────┬────────────────────────────────────────────────────────────┤
│  Frontend App  │                                                             │
│  (React)       │  • Pages: Login, Dashboard, Capsule Form, Release Preview  │
│                │  • Components: Timer, Capsule Card, Contact List           │
│                │  • Crypto: WebCrypto API (PBKDF2, AES-GCM)                │
│                │  • State: React Context/hooks (useEncryption, useCheckIn)  │
└────────┬───────┴────────────────────────────────────────────────────────────┘
         │
         │ REST API over HTTPS (JWT Bearer Token in Authorization header)
         │
┌────────▼────────────────────────────────────────────────────────────────────┐
│                      API Gateway / Backend Server                            │
│                       (Node.js / Express on Fly.io)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Middleware Stack:                                                           │
│  • HTTPS enforcement, CORS (frontend origin only)                           │
│  • Rate limiting (5 login attempts/min, 10 emails/min)                      │
│  • JWT authentication & session validation                                  │
│  • Request validation (input sanitization, file size checks)                │
│  • Error handling (generic user errors, detailed logging)                   │
│  • Audit logging middleware (every security-relevant request)               │
│                                                                              │
│  Route Handlers:                                                            │
│  • /auth/* (signup, login, logout, password-reset)                          │
│  • /capsules/* (CRUD, encryption metadata)                                  │
│  • /checkins/* (extend timer)                                               │
│  • /contacts/* (assign, remove)                                             │
│  • /releases/* (validate token, preview, decrypt)                           │
│  • /audit* (audit log retrieval for resource owner)                         │
│                                                                              │
│  Services:                                                                  │
│  • AuthService (bcrypt hashing, JWT generation)                             │
│  • CapsuleService (CRUD, encryption metadata management)                    │
│  • TimerService (state machine, grace period logic)                         │
│  • ReleaseService (token generation, contact notification)                  │
│  • EmailService (sending/logging emails, retry logic)                       │
│  • AuditService (append-only logging, hash chain verification)              │
│                                                                              │
│  Background Jobs:                                                           │
│  • Timer Checker (every 60s): scan for expired timers, trigger warnings     │
│  • Release Executor (every 60s): scan for grace period expirations          │
│  • Email Retry Queue: exponential backoff (1m, 5m, 15m)                     │
└────────┬────────────────────────────────────────────────────────────────────┘
         │
         │ Drizzle ORM (Type-safe SQL queries)
         │
┌────────▼────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tables:                                                                    │
│  • users (id, email, passwordHash, createdAt, updatedAt, deletedAt)        │
│  • capsules (id, userId, title, encryptedContent, salt, nonce, hash)       │
│  • timers (id, capsuleId, interval, lastCheckin, nextRelease, state)       │
│  • contacts (id, capsuleId, email, name, releaseTokenHash, passphraseHash) │
│  • releases (id, capsuleId, releasedAt, releasedBy, contacts released)     │
│  • auditLog (id, userId, action, resource, timestamp, hash, prevHash)      │
│  • oneTimeTokens (id, tokenHash, capsuleId, contactId, used, usedAt)       │
│  • emailQueue (id, recipient, subject, body, retries, nextRetry, sentAt)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
1. User Registration / Login
   Browser → POST /auth/signup {email, password}
   Server: bcrypt hash password, create user, return JWT
   Browser: store JWT in httpOnly cookie, redirect to dashboard

2. Capsule Creation
   Browser: collect title, description, text, files, passphrase
   Browser: PBKDF2 derive key from passphrase + random salt
   Browser: AES-GCM encrypt content, produce ciphertext + nonce + salt
   Browser → POST /capsules {title, encryptedContent, salt, nonce, files}
   Server: store ciphertext, compute contentHash, initialize timer (ACTIVE)
   Server → Audit: log "CAPSULE_CREATED"

3. Timer Check-in
   Browser → POST /capsules/{id}/checkin
   Server: update lastCheckin = now, nextRelease = now + interval_duration
   Server → Audit: log "CHECK_IN"
   Browser: refresh dashboard timer display

4. Automatic Warning Email (T-7 days)
   Background Job runs every 60s
   For each capsule in ACTIVE state: if (now > nextRelease - 7 days AND not warned)
     EmailService.send("warning_7_day", user.email, capsule.id)
     Mark capsule as "warned_7_days" in database
     AuditLog.append("EMAIL_SENT", capsule.id, "warning_7_day")

5. Grace Period Trigger (T+0 / Timer expires)
   Background Job: if (now > nextRelease AND state == ACTIVE)
     Set timer state = GRACE_PERIOD, graceEndsAt = now + 7 days
     EmailService.send("warning_3_days", user.email, capsule.id)
     AuditLog.append("TIMER_EXPIRED")

6. Capsule Release (T+7 days grace expiration)
   Background Job: if (now > graceEndsAt AND state == GRACE_PERIOD)
     For each contact in capsule.contacts:
       Generate randomToken (32 bytes, cryptographic random)
       Hash token: tokenHash = SHA256(token)
       Store tokenHash in database, mark as "unused"
       EmailService.send("release", contact.email, releaseLink(token))
     Set timer state = RELEASED
     AuditLog.append("CAPSULE_RELEASED")

7. Contact Access via Release Link
   Contact clicks release link with token (URL param: ?token=xyz)
   Browser → GET /releases/{capsuleId}?token=xyz
   Server: 
     - Retrieve capsule and stored tokenHash
     - Compute hash(provided_token)
     - Compare (constant-time) against stored tokenHash
     - If match && unused, return capsule metadata (not content)
     - Return "Release Link valid, enter passphrase to decrypt"
   Contact: enters passphrase in browser
   Browser: 
     - PBKDF2 derive key from passphrase + stored salt
     - Retrieve ciphertext from server
     - AES-GCM decrypt in browser
     - Display plaintext
     - Mark token as "used" via POST /releases/{capsuleId}/confirm
   Server: Mark tokenHash as used, AuditLog.append("CAPSULE_ACCESSED", contact_id)

8. Audit Trail Verification
   User logs in and views capsule details page
   Browser → GET /capsules/{id}/audit
   Server: Return audit log entries for that capsule
   Each entry includes: timestamp, action, hash, prevHash
   Browser: Display entries and verify hash chain (SHA256(prevHash || entry || seqNum) == entry.hash)
```

---

## Data Models

### Database Schema (Drizzle ORM)

```
TABLE users {
  id: UUID PRIMARY KEY
  email: VARCHAR UNIQUE NOT NULL
  passwordHash: VARCHAR NOT NULL (bcrypt, 12+ salt rounds)
  createdAt: TIMESTAMP DEFAULT NOW()
  updatedAt: TIMESTAMP DEFAULT NOW()
  deletedAt: TIMESTAMP NULLABLE (soft delete for GDPR)
}

TABLE capsules {
  id: UUID PRIMARY KEY
  userId: UUID NOT NULL FOREIGN KEY → users.id
  title: VARCHAR NOT NULL
  description: TEXT NULLABLE
  encryptedContent: BYTEA NOT NULL (Base64 or hex encoded in JSON)
  salt: BYTEA NOT NULL (random bytes, 16 bytes typical)
  nonce: BYTEA NOT NULL (96 bits for AES-GCM)
  contentHash: VARCHAR NOT NULL (SHA256 hex string for integrity check)
  createdAt: TIMESTAMP DEFAULT NOW()
  updatedAt: TIMESTAMP DEFAULT NOW()
  releasedAt: TIMESTAMP NULLABLE (when capsule was released)
  
  INDEX ON (userId, createdAt DESC)
  INDEX ON (releasedAt) for active/released queries
}

TABLE timers {
  id: UUID PRIMARY KEY
  capsuleId: UUID NOT NULL UNIQUE FOREIGN KEY → capsules.id
  interval: ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'WEEKLY'
  lastCheckin: TIMESTAMP NOT NULL (initially capsule.createdAt)
  nextRelease: TIMESTAMP NOT NULL (lastCheckin + interval)
  graceEndsAt: TIMESTAMP NULLABLE (nextRelease + 7 days if grace period active)
  state: ENUM('ACTIVE', 'GRACE_PERIOD', 'RELEASED') DEFAULT 'ACTIVE'
  warned7Days: BOOLEAN DEFAULT FALSE
  warned3Days: BOOLEAN DEFAULT FALSE
  createdAt: TIMESTAMP DEFAULT NOW()
  updatedAt: TIMESTAMP DEFAULT NOW()
  
  INDEX ON (state, nextRelease) for background job queries
}

TABLE contacts {
  id: UUID PRIMARY KEY
  capsuleId: UUID NOT NULL FOREIGN KEY → capsules.id
  email: VARCHAR NOT NULL
  name: VARCHAR NULLABLE
  releaseTokenHash: VARCHAR NULLABLE (SHA256 hex)
  releaseTokenExpiry: TIMESTAMP NULLABLE (1 hour after generation)
  passphraseHash: VARCHAR NOT NULL (bcrypt hashed contact passphrase)
  accessed: BOOLEAN DEFAULT FALSE
  accessedAt: TIMESTAMP NULLABLE
  createdAt: TIMESTAMP DEFAULT NOW()
  
  UNIQUE INDEX (capsuleId, email)
}

TABLE releases {
  id: UUID PRIMARY KEY
  capsuleId: UUID NOT NULL FOREIGN KEY → capsules.id
  releasedAt: TIMESTAMP NOT NULL
  releasedBy: VARCHAR (system/manual flag)
  createdAt: TIMESTAMP DEFAULT NOW()
}

TABLE oneTimeTokens {
  id: UUID PRIMARY KEY
  tokenHash: VARCHAR NOT NULL (SHA256 hex)
  capsuleId: UUID NOT NULL FOREIGN KEY → capsules.id
  contactId: UUID NOT NULL FOREIGN KEY → contacts.id
  used: BOOLEAN DEFAULT FALSE
  usedAt: TIMESTAMP NULLABLE
  createdAt: TIMESTAMP DEFAULT NOW()
  
  UNIQUE INDEX (tokenHash)
  INDEX ON (capsuleId, contactId, used)
}

TABLE auditLog {
  id: UUID PRIMARY KEY
  userId: UUID NULLABLE FOREIGN KEY → users.id (nullable for public actions)
  action: VARCHAR NOT NULL (e.g., "LOGIN", "CAPSULE_CREATED", "CHECK_IN", "EMAIL_SENT", "CAPSULE_ACCESSED")
  resourceType: VARCHAR (e.g., "USER", "CAPSULE", "CONTACT", "RELEASE")
  resourceId: VARCHAR NULLABLE
  details: JSONB (e.g., {contactEmail: "...", tokenUsed: true, ip: "..."})
  timestamp: TIMESTAMP NOT NULL (UTC)
  ipHash: VARCHAR NULLABLE (hash of IP for privacy)
  hash: VARCHAR NOT NULL (SHA256 of this entry)
  prevHash: VARCHAR NOT NULL (SHA256 of previous entry, creates chain)
  sequenceNumber: BIGINT NOT NULL UNIQUE AUTO_INCREMENT
  createdAt: TIMESTAMP DEFAULT NOW()
  
  INDEX ON (userId, timestamp DESC)
  INDEX ON (resourceId, timestamp DESC)
  INDEX ON (action, timestamp DESC)
  
  CONSTRAINT: NO UPDATE, NO DELETE (append-only table)
}

TABLE emailQueue {
  id: UUID PRIMARY KEY
  recipient: VARCHAR NOT NULL
  emailType: VARCHAR NOT NULL (e.g., "WARNING_7_DAYS", "RELEASE", "ACCESS_CONFIRMATION")
  subject: VARCHAR NOT NULL
  body: TEXT NOT NULL
  relatedResourceId: UUID NULLABLE (capsule ID or contact ID)
  sent: BOOLEAN DEFAULT FALSE
  sentAt: TIMESTAMP NULLABLE
  retries: INTEGER DEFAULT 0
  nextRetry: TIMESTAMP NULLABLE
  lastError: TEXT NULLABLE
  createdAt: TIMESTAMP DEFAULT NOW()
  
  INDEX ON (sent, nextRetry) for background job queries
}
```

### Entity Relationship Diagram

```
┌──────────────────┐
│     users        │
├──────────────────┤
│ id (PK)          │
│ email (UNIQUE)   │
│ passwordHash     │
│ createdAt        │
│ updatedAt        │
└────────┬─────────┘
         │ 1:N
         │ 
         │
┌────────▼──────────────────┐
│      capsules             │
├───────────────────────────┤
│ id (PK)                   │
│ userId (FK)               │
│ title                     │
│ encryptedContent          │
│ salt                      │
│ nonce                     │
│ contentHash               │
│ createdAt                 │
└────────┬──────────────────┘
         │ 1:1  
         │
┌────────▼──────────────────┐    1:N    ┌──────────────────┐
│      timers               │◄─────────┤   oneTimeTokens  │
├───────────────────────────┤          ├──────────────────┤
│ id (PK)                   │          │ id (PK)          │
│ capsuleId (FK, UNIQUE)    │          │ tokenHash        │
│ interval                  │          │ capsuleId (FK)   │
│ lastCheckin               │          │ contactId (FK)   │
│ nextRelease               │          │ used             │
│ graceEndsAt               │          │ usedAt           │
│ state                     │          └──────────────────┘
│ warned7Days               │
│ warned3Days               │
└────────┬──────────────────┘
         │ N:1
         │
         │
┌────────┴──────────────────┐
│      contacts             │
├───────────────────────────┤
│ id (PK)                   │
│ capsuleId (FK)            │
│ email                     │
│ name                      │
│ releaseTokenHash          │
│ passphraseHash            │
│ accessed                  │
│ accessedAt                │
└───────────────────────────┘

┌──────────────────┐
│   releases       │
├──────────────────┤
│ id (PK)          │
│ capsuleId (FK)   │
│ releasedAt       │
│ releasedBy       │
└──────────────────┘

┌──────────────────────┐
│    auditLog          │
├──────────────────────┤
│ id (PK)              │
│ userId (FK)          │
│ action               │
│ resourceType         │
│ resourceId           │
│ details (JSONB)      │
│ timestamp            │
│ hash                 │
│ prevHash             │
│ sequenceNumber       │
└──────────────────────┘

┌──────────────────────┐
│   emailQueue         │
├──────────────────────┤
│ id (PK)              │
│ recipient            │
│ emailType            │
│ subject              │
│ body                 │
│ sent                 │
│ sentAt               │
│ retries              │
│ nextRetry            │
└──────────────────────┘
```

---

## Components and Interfaces

### Frontend Components

**Authentication Layer:**
- `LoginPage`: Email/password form, JWT storage, session validation
- `RegisterPage`: Email/password registration with validation
- `AuthProvider`: Context wrapper for user state, login/logout/session restore

**Dashboard and Capsules:**
- `Dashboard`: Grid/list of user's capsules, sorted by urgency
- `CapsuleCard`: Individual capsule display with timer, state badge, quick actions
- `CapsuleForm`: Create/edit capsule (title, description, content, passphrase, interval, contacts)
- `CapsuleDetail`: Full capsule view with encryption metadata and contact management
- `ReleasePreview`: Contact view after clicking release link (passphrase entry, decryption)

**Utility Components:**
- `Timer`: Countdown display with candle metaphor visual indicator
- `ContactList`: Display and manage trusted contacts for a capsule
- `EncryptionForm`: Passphrase input with validation and strength meter
- `FileUpload`: Drag-and-drop file upload with size validation
- `AuditLog`: View and verify capsule access history with hash chain verification
- `ErrorBoundary`: Catch and display errors with error IDs for support

**Navigation:**
- `NavBar`: Top navigation with user menu, logout, logo/branding

### Backend Services

**AuthService:**
```
interface AuthService {
  signup(email: string, password: string): Promise<{userId: UUID, token: JWT}>;
  login(email: string, password: string): Promise<{userId: UUID, token: JWT}>;
  logout(token: JWT): Promise<{status: 'logged_out'}>;
  verifyToken(token: JWT): Promise<{userId: UUID, email: string}>;
  resetPassword(email: string): Promise<{status: 'email_sent'}>;
  confirmPasswordReset(token: string, newPassword: string): Promise<{status: 'reset'}>;
}
```

**CapsuleService:**
```
interface CapsuleService {
  createCapsule(userId: UUID, title: string, encryptedContent: string, metadata): Promise<Capsule>;
  getCapsule(userId: UUID, capsuleId: UUID): Promise<Capsule>;
  updateCapsule(userId: UUID, capsuleId: UUID, updates: Partial<Capsule>): Promise<Capsule>;
  deleteCapsule(userId: UUID, capsuleId: UUID): Promise<{status: 'deleted'}>;
  listCapsules(userId: UUID): Promise<Capsule[]>;
  getCapsulesByState(state: 'ACTIVE' | 'GRACE_PERIOD' | 'RELEASED'): Promise<Capsule[]>;
}
```

**TimerService:**
```
interface TimerService {
  initializeTimer(capsuleId: UUID, interval: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Promise<Timer>;
  onCheckIn(capsuleId: UUID): Promise<Timer>;
  scanForExpiredTimers(): Promise<number>; // Returns count of transitioned timers
  scanForGraceExpiry(): Promise<number>;   // Returns count of released capsules
  getTimer(capsuleId: UUID): Promise<Timer>;
}
```

**ReleaseService:**
```
interface ReleaseService {
  generateReleaseToken(capsuleId: UUID, contactId: UUID): Promise<string>; // 32-byte token
  validateReleaseToken(capsuleId: UUID, token: string): Promise<{valid: boolean, contactId?: UUID}>;
  triggerRelease(capsuleId: UUID): Promise<{status: 'released', contactsNotified: number}>;
  markTokenUsed(tokenHash: string): Promise<{status: 'marked_used'}>;
}
```

**EmailService:**
```
interface EmailService {
  send(emailType: string, recipient: string, templateData: object): Promise<{status: 'queued' | 'sent'}>;
  processQueue(): Promise<number>; // Returns count of emails processed
  logDemoEmail(recipient: string, subject: string, body: string): void; // For demo mode
}
```

**AuditService:**
```
interface AuditService {
  log(userId: UUID | null, action: string, resourceType: string, resourceId: UUID, details: object): Promise<AuditEntry>;
  getAuditTrail(resourceId: UUID): Promise<AuditEntry[]>;
  verifyHashChain(entries: AuditEntry[]): Promise<{valid: boolean, firstInvalidIndex?: number}>;
}
```

### API Interfaces

**Request/Response Types:**
```
interface SignupRequest {
  email: string;
  password: string;
}

interface SignupResponse {
  userId: UUID;
  token: JWT;
  expiresIn: number;
}

interface CreateCapsuleRequest {
  title: string;
  description?: string;
  encryptedContent: string; // hex or base64
  salt: string;             // hex
  nonce: string;            // hex
  contentHash: string;      // SHA256 hex
  interval: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  files?: Array<{name: string, data: string}>; // base64
}

interface CreateCapsuleResponse {
  capsuleId: UUID;
  timer: {
    state: 'ACTIVE';
    interval: string;
    nextRelease: timestamp;
  };
}

interface CheckInRequest {
  // No body, auth via JWT
}

interface CheckInResponse {
  timer: {
    state: 'ACTIVE' | 'GRACE_PERIOD' | 'RELEASED';
    lastCheckin: timestamp;
    nextRelease: timestamp;
    graceEndsAt: timestamp | null;
  };
}

interface AddContactRequest {
  email: string;
  name?: string;
  passphrase: string; // Client should validate 8+ chars before sending
}

interface AddContactResponse {
  contactId: UUID;
  email: string;
  name?: string;
  status: 'pending';
}

interface AuditEntryResponse {
  id: UUID;
  timestamp: timestamp;
  action: string;
  resourceType: string;
  resourceId: UUID;
  details: object;
  hash: string;        // SHA256 hex
  prevHash: string;    // SHA256 hex of previous entry
  sequenceNumber: number;
}
```

---

## Timer State Machine

### States and Transitions

```
State: ACTIVE
├─ Meaning: Normal operation, capsule is alive and not released
├─ nextRelease: set when timer is initialized or reset by check-in
├─ Transitions:
│  ├─ Check-in: lastCheckin = now, nextRelease = now + interval, stay in ACTIVE
│  └─ Timer expires: if (now > nextRelease) → GRACE_PERIOD
│     Side effect: graceEndsAt = now + 7 days, send warning email

State: GRACE_PERIOD
├─ Meaning: Timer has expired, 7-day grace period is active
├─ graceEndsAt: set when entering grace period (now + 7 days)
├─ Transitions:
│  ├─ Check-in: lastCheckin = now, nextRelease = now + interval, return to ACTIVE
│  │  Side effect: graceEndsAt = NULL, cancel any pending release
│  └─ Grace period expires: if (now > graceEndsAt) → RELEASED
│     Side effect: generate release links, send emails, mark contacts

State: RELEASED
├─ Meaning: Capsule has been released to all contacts, irreversible
├─ Transitions: (none - terminal state)
└─ Side effects: release links are one-time-use, contacts notified
```

### Timer Calculation

```
FUNCTION calculate_next_release(lastCheckin, interval):
  interval_seconds ← 0
  SWITCH interval:
    CASE 'DAILY': interval_seconds ← 86400 (24 hours)
    CASE 'WEEKLY': interval_seconds ← 604800 (7 days)
    CASE 'MONTHLY': interval_seconds ← 2592000 (30 days)
  END SWITCH
  
  nextRelease ← lastCheckin + interval_seconds
  RETURN nextRelease

FUNCTION calculate_grace_end(nextRelease):
  grace_period_seconds ← 604800 (7 days)
  graceEndsAt ← nextRelease + grace_period_seconds
  RETURN graceEndsAt

PROCEDURE on_timer_check_in(capsule_id):
  capsule ← database.get_capsule(capsule_id)
  timer ← database.get_timer(capsule_id)
  
  NOW ← current_time_utc()
  
  IF timer.state == 'RELEASED':
    RETURN error("Capsule already released, cannot check in")
  END IF
  
  timer.lastCheckin ← NOW
  timer.nextRelease ← calculate_next_release(NOW, timer.interval)
  timer.graceEndsAt ← NULL
  
  IF timer.state == 'GRACE_PERIOD':
    timer.state ← 'ACTIVE'
    timer.warned3Days ← FALSE
  END IF
  
  database.save_timer(timer)
  audit_log.append("CHECK_IN", capsule_id, {userId: capsule.userId})

PROCEDURE background_timer_check():
  FOR each capsule WHERE timer.state != 'RELEASED':
    timer ← database.get_timer(capsule.id)
    NOW ← current_time_utc()
    
    // Check if entering grace period
    IF timer.state == 'ACTIVE' AND NOW > timer.nextRelease:
      timer.state ← 'GRACE_PERIOD'
      timer.graceEndsAt ← calculate_grace_end(timer.nextRelease)
      
      database.save_timer(timer)
      audit_log.append("TIMER_EXPIRED", capsule.id, {state: 'GRACE_PERIOD'})
      
      // Send 3-day warning email (or 7-day if first time seeing grace)
      email_queue.enqueue({
        recipient: capsule.user.email,
        type: 'WARNING_3_DAYS',
        subject: 'Final Notice: Your capsule will release in 3 days',
        body: render_email_template('warning_3_days', capsule),
        relatedResourceId: capsule.id
      })
    END IF
    
    // Check if first time hitting 7-day warning
    IF timer.state == 'ACTIVE' AND NOT timer.warned7Days:
      warning_time ← timer.nextRelease - (7 * 86400)
      IF NOW >= warning_time:
        timer.warned7Days ← TRUE
        database.save_timer(timer)
        
        email_queue.enqueue({
          recipient: capsule.user.email,
          type: 'WARNING_7_DAYS',
          subject: 'Your capsule will release in 7 days unless you check in',
          body: render_email_template('warning_7_days', capsule),
          relatedResourceId: capsule.id
        })
      END IF
    END IF
    
    // Check if releasing
    IF timer.state == 'GRACE_PERIOD' AND NOW > timer.graceEndsAt:
      trigger_capsule_release(capsule)
    END IF
  END FOR

PROCEDURE trigger_capsule_release(capsule):
  release ← releases.create({capsuleId: capsule.id, releasedAt: now(), releasedBy: 'system'})
  
  FOR each contact IN capsule.contacts:
    // Generate and hash token
    randomToken ← crypto.getRandomValues(32 bytes)
    tokenHash ← SHA256(randomToken)
    
    oneTimeTokens.create({
      tokenHash: tokenHash,
      capsuleId: capsule.id,
      contactId: contact.id,
      used: FALSE
    })
    
    // Send release email with one-time link
    releaseLink ← build_url('/releases/' + capsule.id, {token: randomToken})
    email_queue.enqueue({
      recipient: contact.email,
      type: 'RELEASE',
      subject: 'Your capsule from [user] has been released',
      body: render_email_template('release', {
        capsuleName: capsule.title,
        releaseLink: releaseLink,
        passphraseNote: 'Enter the passphrase provided to you separately'
      }),
      relatedResourceId: capsule.id
    })
  END FOR
  
  timer ← database.get_timer(capsule.id)
  timer.state ← 'RELEASED'
  database.save_timer(timer)
  
  audit_log.append('CAPSULE_RELEASED', capsule.id, {contactCount: capsule.contacts.length})
```

---

## Encryption Architecture

### Cryptographic Components

**Client-Side (Browser) - WebCrypto API**

```
FUNCTION derive_encryption_key(passphrase, salt):
  """
  Derives a 256-bit encryption key from a passphrase using PBKDF2.
  
  Precondition:
    - passphrase is a non-empty string
    - salt is 16 random bytes (or deterministic for specific capsule)
  
  Postcondition:
    - Returns a CryptoKey suitable for AES-GCM-256 encryption
    - Same passphrase + salt always produces same key (round-trip property)
  """
  
  passphraseBuffer ← encoder.encode(passphrase)
  
  baseKey ← await crypto.subtle.importKey(
    'raw',
    passphraseBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  keyBits ← await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: 100000
    },
    baseKey,
    256
  )
  
  encryptionKey ← await crypto.subtle.importKey(
    'raw',
    keyBits,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
  
  RETURN encryptionKey

FUNCTION encrypt_capsule(plaintext, passphrase, salt):
  """
  Encrypts capsule content using AES-GCM-256.
  
  Precondition:
    - plaintext is JSON string of capsule content
    - passphrase is non-empty string
    - salt is 16 random bytes
  
  Postcondition:
    - Returns object with { ciphertext (hex), nonce (hex), salt (hex) }
    - Ciphertext is authenticated (tamper detection via auth tag)
    - Different encryptions with same input produce different ciphertexts (nonce is unique)
  """
  
  encryptionKey ← await derive_encryption_key(passphrase, salt)
  
  nonce ← crypto.getRandomValues(new Uint8Array(12)) // 96 bits
  plaintextBuffer ← encoder.encode(plaintext)
  
  cipherBuffer ← await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce
    },
    encryptionKey,
    plaintextBuffer
  )
  
  RETURN {
    ciphertext: bytesToHex(cipherBuffer),
    nonce: bytesToHex(nonce),
    salt: bytesToHex(salt)
  }

FUNCTION decrypt_capsule(ciphertext, passphrase, salt, nonce):
  """
  Decrypts capsule content using AES-GCM-256.
  
  Precondition:
    - ciphertext is hex-encoded ciphertext with auth tag
    - passphrase is the same string used to encrypt
    - salt matches the salt used to derive key
    - nonce matches the nonce used during encryption
  
  Postcondition:
    - Returns plaintext JSON string on success
    - Throws error if authentication tag verification fails (tampering detected)
    - Decryption failure does not reveal whether key or ciphertext was invalid (generic error)
  
  Throws: "Decryption failed: authentication tag verification failed" or similar generic error
  """
  
  encryptionKey ← await derive_encryption_key(passphrase, salt)
  
  cipherBuffer ← hexToBytes(ciphertext)
  nonceBuffer ← hexToBytes(nonce)
  
  TRY
    plaintextBuffer ← await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBuffer
      },
      encryptionKey,
      cipherBuffer
    )
    
    plaintext ← decoder.decode(plaintextBuffer)
    RETURN plaintext
    
  CATCH error:
    THROW new Error("Decryption failed") // Generic error, don't reveal details
  END TRY

FUNCTION compute_content_hash(plaintext):
  """
  Computes a SHA-256 hash of plaintext for integrity verification.
  Used by server to verify ciphertext round-trip without decryption.
  """
  
  plaintextBuffer ← encoder.encode(plaintext)
  hashBuffer ← await crypto.subtle.digest('SHA-256', plaintextBuffer)
  hashHex ← bytesToHex(hashBuffer)
  RETURN hashHex
```

**Server-Side (Node.js)**

```
FUNCTION verify_content_integrity(storedCiphertext, providedContentHash):
  """
  Server cannot decrypt, but can verify that the stored ciphertext
  corresponds to the plaintext that hashed to providedContentHash.
  
  This is used to detect tampering during decryption (contact provides wrong passphrase).
  """
  
  // Note: This is a preventive measure; actual verification occurs client-side
  // when contact decrypts and re-computes hash.
  // Server stores the hash and can audit attempts to access with incorrect hashes.
  RETURN true  // Placeholder; actual implementation defers to client

FUNCTION generate_release_token():
  """
  Generates a cryptographically random 32-byte token for one-time-use release links.
  
  Postcondition:
    - Returns 32 bytes of random data
    - Each call produces unique token (entropy > 256 bits)
  """
  
  token ← crypto.randomBytes(32)
  RETURN token

FUNCTION hash_release_token(token):
  """
  Hashes a release token using SHA-256 for secure storage.
  Token is stored hashed; only provided token is compared against hash.
  """
  
  tokenHash ← SHA256(token)
  RETURN tokenHash

FUNCTION verify_release_token(providedToken, storedTokenHash):
  """
  Verifies that providedToken hashes to storedTokenHash using constant-time comparison.
  
  Precondition:
    - providedToken is a byte string
    - storedTokenHash is a hex string
  
  Postcondition:
    - Returns true if hashes match (within constant time)
    - Returns false without revealing whether comparison failed due to length or content
  
  Throws: none; always returns boolean
  """
  
  providedHash ← SHA256(providedToken)
  
  // Use constant-time comparison to prevent timing attacks
  match ← timingSafeEqual(providedHash, storedTokenHash)
  RETURN match
```

### Round-Trip Encryption Property

```
THEOREM encrypt_decrypt_round_trip:
  FOR ALL plaintext ∈ String, passphrase ∈ String:
    LET salt ← random_bytes(16)
    LET encrypted ← encrypt_capsule(plaintext, passphrase, salt)
    LET decrypted ← decrypt_capsule(encrypted.ciphertext, passphrase, salt, encrypted.nonce)
    
    ASSERT decrypted == plaintext
    
  PROOF:
    1. encrypt_capsule derives key K from (passphrase, salt) using PBKDF2
    2. AES-GCM-256 encrypts plaintext with key K and nonce N, produces C + auth_tag
    3. decrypt_capsule derives same key K from (passphrase, salt) using same PBKDF2 params
    4. AES-GCM-256 decrypts C with key K and nonce N, verifies auth_tag
    5. PBKDF2 is deterministic: same inputs → same key
    6. AES-GCM is symmetric: encrypt(K, N) composed with decrypt(K, N) is identity
    7. Therefore: plaintext == decrypted
```

---

## API Design

### Authentication Endpoints

```
POST /auth/signup
  Request: {email: string, password: string}
  Response: {userId: UUID, token: JWT, expiresIn: number}
  
  Validation:
    - email must be valid format (RFC 5322)
    - password must be 8+ characters
    - email must not already exist
  
  Process:
    - Hash password using bcrypt (12+ salt rounds)
    - Create user record
    - Generate JWT token (exp: 24 hours)
    - Audit log: "USER_REGISTERED"
    - Return token (stored in httpOnly cookie)
  
  Security: bcrypt hashing, rate limit 5 signups/min per IP

POST /auth/login
  Request: {email: string, password: string}
  Response: {userId: UUID, token: JWT, expiresIn: number}
  
  Process:
    - Look up user by email
    - Verify password using bcrypt constant-time comparison
    - Generate JWT token
    - Audit log: "LOGIN_SUCCESS" or "LOGIN_FAILURE"
    - Return token
  
  Security: rate limit 5 login attempts/min per IP, generic error messages

POST /auth/logout
  Request: (Bearer token required)
  Response: {status: 'logged_out'}
  
  Process:
    - Invalidate session token (if stored server-side)
    - Clear httpOnly cookie
    - Audit log: "LOGOUT"
  
  Security: requires valid JWT

GET /auth/session
  Request: (Bearer token required)
  Response: {userId: UUID, email: string, createdAt: timestamp}
  
  Process:
    - Verify JWT token is valid
    - Return user info
    - Used by frontend on page load to restore session

POST /auth/password-reset
  Request: {email: string}
  Response: {status: 'reset_email_sent'}
  
  Process:
    - Generate 32-byte random token
    - Store token hashed with 1-hour expiry
    - Send email with reset link (frontend: /reset/{token})
    - Audit log: "PASSWORD_RESET_REQUESTED"
    - Generic response (don't reveal if email exists)
  
  Security: rate limit 2 resets/min per IP

POST /auth/password-reset/confirm
  Request: {token: string, newPassword: string}
  Response: {status: 'password_reset'}
  
  Process:
    - Verify token exists and not expired
    - Hash new password with bcrypt
    - Update user password
    - Invalidate token (use once)
    - Audit log: "PASSWORD_RESET_COMPLETE"
```

### Capsule Endpoints

```
POST /capsules
  Request: {
    title: string,
    description: string (optional),
    encryptedContent: hex string (Base64 encoded ciphertext),
    salt: hex string,
    nonce: hex string,
    contentHash: hex string (SHA256),
    interval: 'DAILY' | 'WEEKLY' | 'MONTHLY' (default: 'WEEKLY'),
    files: [{name: string, data: Base64}] (optional)
  }
  Response: {capsuleId: UUID, timer: {state, interval, nextRelease}}
  
  Validation:
    - encryptedContent is valid Base64/hex
    - salt is valid hex (16 bytes)
    - nonce is valid hex (12 bytes)
    - title is 1-200 characters
    - interval is valid enum
  
  Process:
    - Create capsule record (store ciphertext, salt, nonce, contentHash)
    - Create timer record (state: ACTIVE, lastCheckin: now, nextRelease: now + interval)
    - Audit log: "CAPSULE_CREATED" with {title, interval}
    - Return capsule ID and timer state
  
  Security: requires JWT, rate limit 10 creates/min per user

GET /capsules
  Request: (Bearer token required)
  Response: [{id, title, interval, timer: {state, nextRelease}, contacts: [{email, name, accessed}]}]
  
  Process:
    - Query all capsules for authenticated user
    - Return metadata (not encrypted content)
    - Sort by urgency (time remaining)
    - Include timer state and contact list
  
  Security: requires JWT, only own capsules

GET /capsules/{id}
  Request: (Bearer token required)
  Response: {id, title, description, interval, timer, encryptedContent, salt, nonce, contentHash, contacts}
  
  Process:
    - Verify user owns capsule
    - Return encrypted content (browser will decrypt client-side)
    - Include all needed metadata for decryption
  
  Security: requires JWT, verify ownership

PUT /capsules/{id}
  Request: {
    title: string (optional),
    description: string (optional),
    encryptedContent: hex string (optional),
    salt: hex string (if content updated),
    nonce: hex string (if content updated),
    contentHash: hex string (if content updated),
    interval: enum (optional)
  }
  Response: {id, updatedAt}
  
  Process:
    - Verify user owns capsule
    - If timer is RELEASED, reject with "Cannot edit released capsule"
    - Update fields (re-encrypt if content provided)
    - Update timer if interval changed
    - Audit log: "CAPSULE_UPDATED" with {fields}
  
  Security: requires JWT, verify ownership, cannot edit released capsules

DELETE /capsules/{id}
  Request: (Bearer token required)
  Response: {status: 'deleted'}
  
  Process:
    - Verify user owns capsule
    - Delete capsule and associated timer, contacts, tokens
    - Audit log: "CAPSULE_DELETED"
    - If capsule released, audit log includes "WARNING: DELETED_RELEASED_CAPSULE"
  
  Security: requires JWT, audit log for compliance

GET /capsules/{id}/audit
  Request: (Bearer token required)
  Response: [{timestamp, action, details, hash, prevHash, sequenceNumber}]
  
  Process:
    - Verify user owns capsule
    - Query audit log for this capsule
    - Return entries with hash chain (prevHash, currentHash)
    - Sorted by timestamp DESC
  
  Security: requires JWT, verify ownership
```

### Check-in Endpoints

```
POST /capsules/{id}/checkin
  Request: (Bearer token required)
  Response: {timer: {state, lastCheckin, nextRelease, graceEndsAt}}
  
  Process:
    - Verify user owns capsule
    - Update timer: lastCheckin = now, nextRelease = now + interval
    - If state == GRACE_PERIOD, set state = ACTIVE, graceEndsAt = NULL
    - Audit log: "CHECK_IN" with {userId, capsuleId, newNextRelease}
    - Broadcast WebSocket update to dashboard (optional, for real-time)
  
  Security: requires JWT, verify ownership, rate limit 1 checkin/min per capsule

GET /capsules/{id}/checkins
  Request: (Bearer token required, query: limit=10)
  Response: [{timestamp, userId (optional)}]
  
  Process:
    - Verify user owns capsule
    - Query audit log for CHECK_IN actions on this capsule
    - Return last N check-ins (default 5, max 100)
    - Timestamps rounded to hour for privacy
  
  Security: requires JWT, verify ownership
```

### Contact Endpoints

```
POST /capsules/{id}/contacts
  Request: {email: string, name: string (optional), passphrase: string}
  Response: {contactId: UUID, email, name, status: 'pending'}
  
  Validation:
    - email is valid format
    - passphrase is 8+ characters
    - contact email not already assigned
  
  Process:
    - Verify user owns capsule
    - Hash passphrase using bcrypt (12 salt rounds)
    - Create contact record (store email, name, passphraseHash)
    - Audit log: "CONTACT_ADDED" with {contactEmail}
    - Return contact ID
  
  Security: requires JWT, passphrase never sent to server, rate limit 10 contacts/min

GET /capsules/{id}/contacts
  Request: (Bearer token required)
  Response: [{id, email, name, accessed, accessedAt}]
  
  Process:
    - Verify user owns capsule
    - Return contact list (not passphrases)
    - Include access status (accessed, timestamp if released)
  
  Security: requires JWT, verify ownership

DELETE /capsules/{id}/contacts/{contactId}
  Request: (Bearer token required)
  Response: {status: 'removed'}
  
  Process:
    - Verify user owns capsule
    - Delete contact record
    - If capsule released, invalidate any tokens for this contact
    - Audit log: "CONTACT_REMOVED" with {contactEmail}
  
  Security: requires JWT, verify ownership
```

### Release Endpoints

```
GET /releases/{capsuleId}?token={token}
  Request: query param: token (URL param, no auth required)
  Response: {capsuleId, title, description, salt, nonce, encryptedContent, passphrasePrompt: "Enter your passphrase"}
  
  Validation:
    - token is 32-byte hex string
    - capsuleId is valid UUID
  
  Process:
    - Look up capsule by ID
    - Verify capsule is in RELEASED state
    - Query oneTimeTokens for tokenHash = SHA256(token)
    - Verify token exists, is not used, and capsuleId matches
    - If token invalid/used, reject with generic error (don't reveal which)
    - If valid, return capsule metadata for decryption
    - Frontend: prompt contact for passphrase, decrypt client-side
  
  Security: no auth required, but token is cryptographically strong
            rate limit 10 attempts/IP/second for token verification

POST /releases/{capsuleId}/confirm
  Request: {tokenHash: string} (hash of token from URL)
  Response: {status: 'confirmed', accessedAt: timestamp}
  
  Process:
    - Verify token exists and corresponds to this capsule
    - Mark token as used: oneTimeTokens.used = TRUE, usedAt = NOW
    - Update contact record: accessed = TRUE, accessedAt = NOW
    - Audit log: "CAPSULE_ACCESSED" with {contactId, tokenHash (not plaintext)}
    - Return confirmation
  
  Security: rate limit 1 confirm/IP/second, token becomes invalid immediately

GET /releases/{capsuleId}/audit (optional)
  Request: (Bearer token required - only user can view)
  Response: [{timestamp, contactEmail, action, accessed}]
  
  Process:
    - Verify user owns capsule
    - Query audit log for CAPSULE_ACCESSED events
    - Return access history (who opened capsule, when)
  
  Security: requires JWT, verify ownership
```

### Audit Log Endpoints

```
GET /audit/capsule/{capsuleId}
  Request: (Bearer token required)
  Response: [{id, timestamp, action, details, hash, prevHash, sequenceNumber}]
  
  Process:
    - Verify user owns capsule
    - Query auditLog where resourceId = capsuleId
    - Sort by sequenceNumber DESC
    - Verify hash chain (optional client-side verification)
  
  Security: requires JWT, verify ownership

GET /audit/self
  Request: (Bearer token required)
  Response: [{id, timestamp, action, details}] (last 50)
  
  Process:
    - Query auditLog where userId = authenticated user
    - Return recent audit events (login, password changes, etc.)
  
  Security: requires JWT, can only view own events
```

---

## Frontend Architecture

### Component Structure

```
src/
├── pages/
│   ├── Login.tsx (email/password form, JWT storage)
│   ├── Dashboard.tsx (capsule list, timer display, check-in button)
│   ├── CapsuleForm.tsx (create/edit, encryption UI, file upload)
│   ├── CapsuleDetail.tsx (view encrypted content, edit contacts)
│   ├── ReleasePreview.tsx (contact view, passphrase entry, decryption)
│   └── AuditLog.tsx (view audit trail, verify hash chain)
│
├── components/
│   ├── Timer.tsx (countdown display, candle metaphor)
│   ├── CapsuleCard.tsx (title, state badge, urgency indicator)
│   ├── ContactList.tsx (add/remove contacts)
│   ├── EncryptionForm.tsx (passphrase input, validation)
│   ├── FileUpload.tsx (drag-drop, size validation)
│   ├── NavBar.tsx (auth state, logout)
│   └── ErrorBoundary.tsx (error handling, user-friendly messages)
│
├── hooks/
│   ├── useAuth.ts (JWT management, login/logout, session restore)
│   ├── useEncryption.ts (PBKDF2, AES-GCM encrypt/decrypt)
│   ├── useCapsules.ts (API calls: CRUD, state management)
│   ├── useCheckIn.ts (check-in API, timer refresh)
│   ├── useTimer.ts (countdown logic, visual urgency)
│   └── useAuditLog.ts (fetch and verify hash chain)
│
├── utils/
│   ├── crypto.ts (WebCrypto wrapper, PBKDF2, AES-GCM)
│   ├── api.ts (REST client, JWT headers, error handling)
│   ├── validation.ts (email, password, passphrase validators)
│   ├── encoding.ts (Base64, hex conversion)
│   └── audit.ts (hash chain verification)
│
├── context/
│   ├── AuthContext.tsx (user state, JWT, session)
│   ├── ThemeContext.tsx (dark mode, styling)
│   └── SocketContext.tsx (optional WebSocket for real-time updates)
│
├── types/
│   └── index.ts (TypeScript interfaces: User, Capsule, Timer, Contact, AuditEntry)
│
├── styles/
│   └── globals.css (Tailwind, candle metaphor animations)
│
└── App.tsx (router setup, layout)
```

### Key Hooks Implementation

```typescript
// useEncryption.ts
FUNCTION useEncryption() {
  ASYNC FUNCTION deriveKey(passphrase, salt) {
    // Call WebCrypto PBKDF2 (100k iterations, SHA-256)
    // Return CryptoKey
  }
  
  ASYNC FUNCTION encrypt(plaintext, passphrase) {
    // Generate random salt (16 bytes)
    // Derive key from passphrase + salt
    // Generate random nonce (12 bytes)
    // Encrypt plaintext using AES-GCM-256
    // Compute SHA256 hash of plaintext
    // Return { ciphertext, salt, nonce, contentHash }
  }
  
  ASYNC FUNCTION decrypt(ciphertext, passphrase, salt, nonce) {
    // Derive key from passphrase + salt
    // Decrypt ciphertext using AES-GCM-256
    // On success: return plaintext
    // On error: return generic error (don't reveal details)
  }
  
  RETURN { deriveKey, encrypt, decrypt }
}

// useAuth.ts
FUNCTION useAuth() {
  STATE user = NULL
  STATE token = NULL
  
  FUNCTION login(email, password) {
    response ← POST /auth/login { email, password }
    IF response.ok:
      token ← response.token
      user ← response.user
      sessionStorage.setItem('token', token) // or rely on httpOnly cookie
      RETURN { success: true }
    ELSE:
      RETURN { success: false, error: 'Invalid credentials' }
  }
  
  FUNCTION logout() {
    POST /auth/logout
    token ← NULL
    user ← NULL
    sessionStorage.removeItem('token')
  }
  
  FUNCTION restoreSession() {
    // On app load, verify JWT is valid
    GET /auth/session
    IF response.ok:
      user ← response.user
      RETURN true
    ELSE:
      RETURN false
  }
  
  RETURN { user, login, logout, restoreSession, isAuthenticated: !!token }
}

// useCapsules.ts
FUNCTION useCapsules() {
  STATE capsules = []
  STATE loading = false
  
  ASYNC FUNCTION fetchCapsules() {
    loading ← true
    response ← GET /capsules
    IF response.ok:
      capsules ← response.data (sorted by urgency)
      loading ← false
      RETURN capsules
  }
  
  ASYNC FUNCTION createCapsule(title, description, plaintext, passphrase, interval) {
    // Client-side encryption
    encrypted ← await useEncryption.encrypt(plaintext, passphrase)
    
    request ← {
      title,
      description,
      encryptedContent: encrypted.ciphertext,
      salt: encrypted.salt,
      nonce: encrypted.nonce,
      contentHash: encrypted.contentHash,
      interval
    }
    
    response ← POST /capsules request
    IF response.ok:
      capsules.push(response.capsule)
      RETURN response.capsule
  }
  
  ASYNC FUNCTION editCapsule(id, updates) {
    // Similar to create but includes id
    response ← PUT /capsules/{id} updates
    IF response.ok:
      // Update local state
  }
  
  RETURN { capsules, loading, fetchCapsules, createCapsule, editCapsule }
}

// useTimer.ts
FUNCTION useTimer(capsule) {
  STATE remainingSeconds = calculateRemaining(capsule.timer.nextRelease)
  STATE timerDisplay = formatTime(remainingSeconds)
  STATE urgency = 'normal' | 'warning' | 'critical' | 'released'
  
  FUNCTION calculateRemaining(nextReleaseTimestamp) {
    now ← Date.now()
    remainingMs ← nextReleaseTimestamp - now
    RETURN Math.max(0, remainingMs / 1000)
  }
  
  FUNCTION determineUrgency(state, remainingSeconds) {
    IF state == 'RELEASED':
      RETURN 'released'
    ELSE IF state == 'GRACE_PERIOD':
      RETURN 'critical'
    ELSE IF remainingSeconds < (7 * 86400): // Less than 7 days
      RETURN 'warning'
    ELSE:
      RETURN 'normal'
  }
  
  // Update timer every second
  EFFECT:
    interval ← setInterval(() => {
      remainingSeconds ← calculateRemaining(capsule.timer.nextRelease)
      timerDisplay ← formatTime(remainingSeconds)
      urgency ← determineUrgency(capsule.timer.state, remainingSeconds)
    }, 1000)
    
    RETURN () => clearInterval(interval)
  
  RETURN { timerDisplay, urgency, remainingSeconds }
}
```

### Candle Metaphor Component

```typescript
// components/Timer.tsx
COMPONENT Timer({ capsule }) {
  { timerDisplay, urgency, remainingSeconds } ← useTimer(capsule)
  
  FUNCTION calculateCandleHeight() {
    // Height is proportional to time remaining
    
    IF capsule.timer.state == 'RELEASED':
      RETURN 0 // Candle is extinguished
    
    ELSE IF capsule.timer.state == 'GRACE_PERIOD':
      // Grace period: show minimal flame (10%) in orange/red
      RETURN 10
    
    ELSE:
      // Active: scale height from 0-100% based on interval completion
      intervalSeconds ← interval_to_seconds(capsule.timer.interval)
      elapsedSeconds ← now() - capsule.timer.lastCheckin
      progressFraction ← Math.min(1, elapsedSeconds / intervalSeconds)
      candleHeight ← 100 * (1 - progressFraction)
      RETURN candleHeight
    
  }
  
  FUNCTION getFlameColor() {
    IF urgency == 'released':
      RETURN 'gray' // Extinguished
    ELSE IF urgency == 'critical':
      RETURN 'red'
    ELSE IF urgency == 'warning':
      RETURN 'orange'
    ELSE:
      RETURN 'gold'
  }
  
  RETURN (
    <div className="candle-container">
      <div className="candle-body">
        <div
          className="candle-flame"
          style={{
            height: `${calculateCandleHeight()}%`,
            backgroundColor: getFlameColor(),
            transition: 'height 0.3s, background-color 0.3s'
          }}
        />
      </div>
      <div className="timer-text">
        {timerDisplay}
        {urgency == 'critical' && <span className="urgent-badge">URGENT</span>}
      </div>
    </div>
  )
}
```

---

## Backend Architecture

### Service Layer

```
CapsuleService
├─ createCapsule(userId, title, encryptedContent, salt, nonce, contentHash, interval)
│  └─ Validate input, create capsule, initialize timer
├─ getCapsule(userId, capsuleId)
│  └─ Verify ownership, return encrypted content + metadata
├─ updateCapsule(userId, capsuleId, updates)
│  └─ Verify not released, update encrypted content if provided
└─ deleteCapsule(userId, capsuleId)
   └─ Delete capsule and associated data

TimerService
├─ initializeTimer(capsuleId, interval)
│  └─ Create timer record
├─ onCheckIn(capsuleId)
│  └─ Update lastCheckin, reset nextRelease, return to ACTIVE if in grace
├─ scanForExpiredTimers()
│  └─ Background job: find ACTIVE timers past nextRelease, transition to GRACE_PERIOD
└─ scanForGraceExpiry()
   └─ Background job: find GRACE_PERIOD timers past graceEndsAt, trigger release

ReleaseService
├─ triggerRelease(capsuleId)
│  └─ For each contact, generate token, store hashed, queue emails
├─ validateReleaseToken(capsuleId, token)
│  └─ Hash token, compare against stored hash (constant-time), return contact info
└─ markTokenUsed(tokenId)
   └─ Set used = TRUE, usedAt = NOW

EmailService
├─ send(emailType, recipient, templateData)
│  └─ Render template, queue in emailQueue (or send immediately if in-memory)
├─ processQueue()
│  └─ Background job: send queued emails, retry on failure
└─ logDemoEmail(emailType, recipient, subject, body)
   └─ In demo mode: log to console instead of sending

AuditService
├─ log(userId, action, resourceType, resourceId, details)
│  └─ Append entry to auditLog, compute hash chain
├─ getAuditTrail(resourceId)
│  └─ Query auditLog for resource, return with hash chain
└─ verifyHashChain(entries)
   └─ Verify each entry's hash matches computed hash of data + prevHash
```

### Middleware Stack

```
MIDDLEWARE cors_policy:
  ALLOW_ORIGINS ← [process.env.FRONTEND_URL]
  ALLOW_METHODS ← ['GET', 'POST', 'PUT', 'DELETE']
  ALLOW_HEADERS ← ['Content-Type', 'Authorization']
  ALLOW_CREDENTIALS ← true
  
MIDDLEWARE https_enforcement:
  IF request.protocol != 'https' AND NOT development_mode:
    RETURN redirect to HTTPS

MIDDLEWARE rate_limiter:
  IMPLEMENT token bucket algorithm per IP
  LOGIN: 5 attempts / 1 minute
  EMAIL_SEND: 10 emails / 1 minute
  API_GENERAL: 100 requests / 1 minute
  RELEASE_TOKEN_VERIFY: 10 attempts / 1 second

MIDDLEWARE jwt_authentication:
  token ← extract from Authorization header or httpOnly cookie
  IF NOT token or token expired:
    IF route requires auth: RETURN 401 Unauthorized
  ELSE:
    decode token, attach user to request
    request.user ← decoded_token_payload

MIDDLEWARE input_validation:
  FOR each request with body:
    TRY validate against schema
    CATCH validation error:
      RETURN 400 Bad Request with sanitized error message

MIDDLEWARE error_handler:
  TRY execute route
  CATCH error:
    LOG error server-side (timestamp, stack trace, user ID, path)
    errorId ← generate unique UUID
    RETURN 500 with generic message: "An error occurred. Error ID: {errorId}"

MIDDLEWARE audit_logging:
  AFTER each security-relevant request (login, capsule create, check-in, etc.):
    AuditService.log(user.id, action, resourceType, resourceId, {ip, userAgent, ...})

MIDDLEWARE security_headers:
  SET response header 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  SET response header 'X-Content-Type-Options': 'nosniff'
  SET response header 'X-Frame-Options': 'DENY'
  SET response header 'Content-Security-Policy': 'default-src https: ... (restrict script sources)'
  SET response header 'X-XSS-Protection': '1; mode=block'
```

### Background Jobs

```
JOB timer_checker (runs every 60 seconds):
  FOR each capsule WHERE timer.state != 'RELEASED':
    timer ← database.get_timer(capsule.id)
    NOW ← current_time_utc()
    
    IF timer.state == 'ACTIVE':
      // Check 7-day warning
      IF NOT timer.warned7Days:
        warning_time ← timer.nextRelease - (7 * 86400)
        IF NOW >= warning_time:
          timer.warned7Days ← TRUE
          database.save_timer(timer)
          EmailService.send('WARNING_7_DAYS', capsule.user.email, {capsuleId: capsule.id})
      
      // Check timer expiration
      IF NOW > timer.nextRelease:
        timer.state ← 'GRACE_PERIOD'
        timer.graceEndsAt ← NOW + (7 * 86400)
        database.save_timer(timer)
        EmailService.send('WARNING_3_DAYS', capsule.user.email, {capsuleId: capsule.id})
        AuditService.log(capsule.userId, 'TIMER_EXPIRED', 'CAPSULE', capsule.id, {})

JOB grace_period_checker (runs every 60 seconds):
  FOR each capsule WHERE timer.state == 'GRACE_PERIOD':
    timer ← database.get_timer(capsule.id)
    NOW ← current_time_utc()
    
    IF NOW > timer.graceEndsAt:
      ReleaseService.triggerRelease(capsule.id)

JOB email_retry_queue (runs every 5 minutes):
  FOR each emailQueue entry WHERE sent == FALSE AND nextRetry <= NOW:
    TRY:
      EmailService.send_email(entry.recipient, entry.subject, entry.body)
      entry.sent ← TRUE
      entry.sentAt ← NOW
      database.save_email_queue_entry(entry)
    CATCH error:
      entry.retries ← entry.retries + 1
      IF entry.retries > 3:
        entry.sent ← FALSE // Mark as failed permanently
        database.save_email_queue_entry(entry)
        AuditService.log(NULL, 'EMAIL_FAILED', 'EMAIL', entry.id, {error: error.message})
      ELSE:
        // Exponential backoff
        backoff_minutes ← [1, 5, 15][entry.retries - 1]
        entry.nextRetry ← NOW + (backoff_minutes * 60)
        database.save_email_queue_entry(entry)
```

---

## Demo Mode Implementation

### Demo Configuration

```
ENVIRONMENT VARIABLES:

Backend (.env):
  DEMO_MODE=true
  DEMO_ACCOUNT_EMAIL=judge@demo.local
  DEMO_ACCOUNT_PASSWORD=demo
  TIMER_MULTIPLIER=1000 // 1 second = 1000 seconds real time
  LOG_TO_CONSOLE=true

Frontend (.env.local):
  VITE_DEMO_MODE=true
  VITE_TIMER_MULTIPLIER=1000
```

### Demo Data Pre-Population

```
ON BACKEND STARTUP (if DEMO_MODE=true):
  
  // Create or verify demo account
  TRY:
    demo_user ← database.find_user_by_email('judge@demo.local')
  CATCH:
    demo_user ← create_user({
      email: 'judge@demo.local',
      password: 'demo' (bcrypt hashed)
    })
  
  // Clear existing demo capsules (optional, for fresh state)
  DELETE all capsules for demo_user
  
  // Pre-populate demo capsules
  
  CAPSULE 1: "Active Capsule" (normal state)
  ├─ title: "My Personal Legacy"
  ├─ description: "Important information and messages"
  ├─ plaintext: "..."
  ├─ passphrase: "judge-active-123"
  ├─ interval: DAILY
  ├─ lastCheckin: NOW - 12 hours (halfway to next release)
  ├─ nextRelease: NOW + 12 hours
  ├─ state: ACTIVE
  ├─ contact: judge-contact@demo.local (passphrase: judge-contact-active)
  
  CAPSULE 2: "Grace Period Capsule" (warning state)
  ├─ title: "Emergency Instructions"
  ├─ state: GRACE_PERIOD
  ├─ nextRelease: NOW - 2 hours (already expired)
  ├─ graceEndsAt: NOW + 5 minutes (grace ending soon for demo effect)
  ├─ warned7Days: TRUE
  ├─ warned3Days: TRUE
  ├─ contact: judge-contact2@demo.local (passphrase: judge-contact-grace)
  
  CAPSULE 3: "Released Capsule" (released state)
  ├─ title: "Account Access"
  ├─ state: RELEASED
  ├─ releasedAt: NOW - 1 hour
  ├─ contact: judge-contact3@demo.local (accessed: TRUE, accessedAt: NOW - 30min)

ON BROWSER STARTUP (if VITE_DEMO_MODE=true):
  CONSOLE.LOG("[DEMO] Legacy Switch Demo Mode Active")
  CONSOLE.LOG("[DEMO] Timer acceleration: 1000x")
  CONSOLE.LOG("[DEMO] Demo account: judge@demo.local / demo")
  CONSOLE.LOG("[DEMO] Pre-populated capsules loaded")
```

### Demo Timer Acceleration

```
FUNCTION getTimerValue(realTimeMs):
  IF DEMO_MODE:
    // Convert real milliseconds to accelerated milliseconds
    // 1 real second = 1000 real seconds
    acceleratedMs ← realTimeMs * TIMER_MULTIPLIER
    RETURN acceleratedMs
  ELSE:
    RETURN realTimeMs

FUNCTION calculateNextRelease(lastCheckin, interval):
  intervalSeconds ← interval_to_seconds(interval) // 86400 for daily, etc.
  
  IF DEMO_MODE:
    // Compress interval: 24 hours becomes 1.44 seconds
    intervalSeconds ← intervalSeconds / TIMER_MULTIPLIER
  
  nextRelease ← lastCheckin + intervalSeconds
  RETURN nextRelease
```

### Demo Email Logging

```
FUNCTION log_demo_email(recipient, emailType, subject, body):
  CONSOLE.LOG("[DEMO] Email Send Event")
  CONSOLE.LOG(`  Recipient: ${recipient}`)
  CONSOLE.LOG(`  Type: ${emailType}`)
  CONSOLE.LOG(`  Subject: ${subject}`)
  CONSOLE.LOG(`  Body preview: ${body.substring(0, 100)}...`)
  CONSOLE.LOG(`  Timestamp: ${new Date().toISOString()}`)
  CONSOLE.LOG("---")

// Hook in EmailService:
IF DEMO_MODE:
  log_demo_email(recipient, emailType, subject, body)
ELSE:
  SEND via SMTP provider
```

---

## Security Boundaries & Threat Model

### Trust Boundaries

```
NEVER ON SERVER (Always in Browser or Hashed):
  ✗ User passwords (only bcrypt hashes)
  ✗ Capsule passphrases (only salt stored with ciphertext)
  ✗ Decrypted capsule contents (always encrypted at rest)
  ✗ Contact passphrases (only bcrypt hashes)
  ✗ Private encryption keys (derived fresh from passphrase each time)

ALWAYS ON SERVER (Encrypted or Hashed):
  ✓ Ciphertext (encrypted capsule contents)
  ✓ Salt + nonce (needed for decryption, stored with ciphertext)
  ✓ Content hash (SHA256, for integrity checks)
  ✓ Release token hashes (SHA256, one-time-use tokens)
  ✓ Audit log (immutable, with tamper-evident hash chain)
  ✓ User email addresses (needed for notifications)

PUBLIC INFORMATION (No Secrets):
  ✓ Capsule titles (released capsules visible to contacts)
  ✓ Timer states (intervals, last check-in time, next release time)
  ✓ Release links with tokens (but tokens are cryptographically strong)
```

### Threat Scenarios & Mitigations

```
THREAT: Server Compromise (Attacker gains database access)
  IMPACT: Attacker has ciphertext, salt, nonce
  MITIGATION:
    - Attacker cannot decrypt without user/contact passphrase (passphrase never transmitted)
    - Audit log tamper-detection (hash chain) alerts to unauthorized access
    - Recommend users rotate passphrases if compromise suspected

THREAT: Database Backup Exfiltration
  IMPACT: Attacker obtains encrypted backup
  MITIGATION:
    - Backups encrypted with separate key
    - Passphrases not in backups (only hashes)
    - Audit log in separate encrypted storage

THREAT: Network Eavesdropping (HTTP instead of HTTPS)
  IMPACT: Attacker intercepts JWT token, capsule data
  MITIGATION:
    - HTTPS mandatory (HTTP redirects to HTTPS)
    - HSTS headers force HTTPS for future visits
    - JWT tokens have short expiry (24 hours)
    - Credentials never sent over insecure connection

THREAT: Session Hijacking (Attacker steals JWT token)
  IMPACT: Attacker impersonates user
  MITIGATION:
    - JWT stored in httpOnly cookie (not accessible to JavaScript)
    - Session timeout: 30 minutes inactivity, 24 hours absolute max
    - Logout invalidates session
    - Audit log records all logins (user can detect unauthorized access)

THREAT: Brute Force Attack on Release Link Token
  IMPACT: Attacker tries random tokens to access released capsule
  MITIGATION:
    - Token is 32 bytes = 256 bits of entropy (2^256 possible values)
    - Rate limiting: 10 attempts per second per IP
    - Each token is single-use (marked used after first access)

THREAT: Brute Force Attack on Contact Passphrase
  IMPACT: Attacker tries passwords to decrypt capsule
  MITIGATION:
    - Contact passphrase hashed with bcrypt (12+ salt rounds)
    - Server rate limits: 10 failed attempts → 15-minute lockout
    - Passphrase is distinct from user password (raising bar for attacker)

THREAT: Malicious Contact Gets Release Link
  IMPACT: Attacker who has contact email gets capsule access
  MITIGATION:
    - Contact passphrase must be provided separately (not in email)
    - User has option to rotate contact assignment before release
    - Audit log records who accessed capsule and when

THREAT: XSS Attack Injected into Capsule Content
  IMPACT: User's browser executes attacker script when viewing capsule
  MITIGATION:
    - Capsule content treated as plaintext, displayed in <textarea> or similar
    - No inline script execution (Content Security Policy header)
    - Sanitize/escape content before display
    - Input validation on server and client

THREAT: Timing Attack on PBKDF2 Key Derivation
  IMPACT: Attacker measures derivation time to infer passphrase strength
  MITIGATION:
    - PBKDF2 inherently slow (100,000 iterations minimizes timing variance)
    - Browser-side, so no network timing leakage
    - Constant-time comparison for token/hash verification

THREAT: User Forgets Capsule Passphrase
  IMPACT: Capsule contents lost (cannot recover)
  MITIGATION:
    - User can store passphrase in separate location (password manager, paper)
    - No recovery mechanism (by design - server cannot recover)
    - User can delete capsule and create new one
    - Audit log shows what was deleted (for compliance)
```

---

## Error Handling

### Error Scenarios

**Authentication Errors:**
- Invalid credentials: 401 Unauthorized with generic message "Invalid email or password"
- Session expired: 401 Unauthorized, redirect to login
- Missing JWT: 401 Unauthorized if endpoint requires auth
- Invalid JWT: 401 Unauthorized

**Capsule Errors:**
- Capsule not found: 404 Not Found
- Not owner: 403 Forbidden (user is authenticated but doesn't own capsule)
- Cannot edit released capsule: 400 Bad Request with message "Capsule has been released and cannot be edited"
- Invalid encryption metadata (salt/nonce malformed): 400 Bad Request with validation error

**Release Link Errors:**
- Token not found or already used: 403 Forbidden with generic message "Link is invalid or has expired"
- Invalid token format: 400 Bad Request
- Contact passphrase incorrect (after 10 attempts): 429 Too Many Requests with message "Too many failed attempts. Please try again in 15 minutes"

**Rate Limiting Errors:**
- Login attempts exceeded: 429 Too Many Requests with message "Too many login attempts. Please try again in 1 minute"
- Email send quota exceeded: 429 Too Many Requests
- General rate limit: 429 Too Many Requests

**Server Errors:**
- Database connection failure: 500 Internal Server Error with error ID "ERR-UUID"
- SMTP failure (after retries exhausted): 500 Internal Server Error with error ID
- WebCrypto operation failure: Generic "Decryption failed" error (don't reveal crypto details)

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "errorId": "ERR-a1b2c3d4",
    "timestamp": "2024-01-15T12:34:56Z"
  }
}
```

### Client-Side Error Recovery

- Display user-friendly error messages (not raw exception stack traces)
- Provide error IDs for support tickets
- Suggest next actions: "Try again later", "Contact support", "Check your internet connection"
- Log errors to browser console (development) or error tracking service (production)
- Never display encryption keys, passphrases, or sensitive data in error messages

### Encryption Error Handling

- **Decryption failure**: Catch and return generic error "Decryption failed"
  - Don't reveal whether passphrase or ciphertext was invalid
  - Log to audit as failed access attempt (if release link)
  - Rate limit after 10 failures

- **Key derivation failure**: Unlikely (PBKDF2 is robust), but catch and return generic error
  - Recommend user try again or contact support

- **Tamper detection** (AES-GCM authentication tag failure): Return generic error
  - Alert: Ciphertext has been modified
  - Log as security event in audit log

---

## Correctness Properties

### Property 1: Encryption Round-Trip Invariant

**Validates: Requirements 3, 4, 30**

```
PROPERTY: encrypt_decrypt_round_trip
  FOR ALL plaintext ∈ String, passphrase ∈ String:
    LET salt ← random_bytes(16)
    LET encrypted ← encrypt(plaintext, passphrase, salt)
    LET decrypted ← decrypt(encrypted.ciphertext, passphrase, salt, encrypted.nonce)
    
    ASSERT decrypted == plaintext
    
  PROOF:
    - PBKDF2 is deterministic: derive(pass, salt, iterations=100k) → same key
    - AES-GCM is symmetric: same (key, nonce, plaintext) → same ciphertext
    - Reverse: same (key, nonce, ciphertext) → same plaintext
    - Authentication tag ensures ciphertext not modified
    - Therefore: encrypt(p, pw, s) → store → decrypt(pw, s) → p
```

### Property 2: Timer State Machine Transitions

**Validates: Requirements 5, 6, 7**

```
PROPERTY: timer_state_machine_valid
  FOR ALL capsules WHERE timer != NULL:
    state ← timer.state
    nextRelease ← timer.nextRelease
    graceEndsAt ← timer.graceEndsAt
    
    CASE state == 'ACTIVE':
      ASSERT graceEndsAt == NULL
      ASSERT nextRelease > now()
      ASSERT no release links generated yet
      POSTCONDITION: 
        - On check-in: state stays ACTIVE, nextRelease reset
        - On timer expire: state → GRACE_PERIOD, graceEndsAt set
    
    CASE state == 'GRACE_PERIOD':
      ASSERT nextRelease <= now()
      ASSERT graceEndsAt > now()
      ASSERT graceEndsAt == nextRelease + (7 * 86400 seconds)
      POSTCONDITION:
        - On check-in: state → ACTIVE, graceEndsAt = NULL
        - On grace expire: state → RELEASED (irreversible)
    
    CASE state == 'RELEASED':
      ASSERT release links generated for all contacts
      ASSERT all contacts notified via email
      ASSERT state == 'RELEASED' (terminal state, no transitions)
      POSTCONDITION: state cannot change
```

### Property 3: Single-Use Release Link Tokens

**Validates: Requirements 9, 28**

```
PROPERTY: release_token_single_use
  FOR ALL tokens T in oneTimeTokens:
    ASSERT T.used == TRUE → (T.usedAt != NULL ∧ future_access(T) == DENIED)
    ASSERT T.used == FALSE → (future_access(T) == ALLOWED at most once)
    
  INVARIANT:
    - Each token unique (SHA256 of random 32 bytes)
    - After use: oneTimeTokens.used = TRUE, usedAt = NOW
    - On re-access: system checks used=TRUE, returns "Link expired"
```

### Property 4: Audit Log Tamper Detection

**Validates: Requirements 13, 14, 15**

```
PROPERTY: audit_log_tamper_detection
  FOR ALL entries E_i, E_{i+1} in auditLog:
    LET hash_i ← SHA256(E_i.prevHash || E_i.data || E_i.seqNum)
    LET hash_{i+1} ← SHA256(E_{i+1}.prevHash || E_{i+1}.data || E_{i+1}.seqNum)
    
    INVARIANT:
      - E_i.hash == hash_i (computed hash matches stored)
      - E_{i+1}.prevHash == E_i.hash (chain links correctly)
    
    THEOREM: IF E_i is modified after creation THEN tampering is detected
      LET new_hash_i ← SHA256(E_i.prevHash || E_i.modified_data || E_i.seqNum)
      ASSERT new_hash_i != E_i.hash
      ASSERT E_{i+1}.prevHash != new_hash_i
      ∴ chain verification fails, tampering detected
```

### Property 5: Check-In Extends Timer

**Validates: Requirements 5, 6**

```
PROPERTY: check_in_extends_timer
  FOR ALL capsules WHERE state ∈ {'ACTIVE', 'GRACE_PERIOD'}:
    BEFORE:
      nextRelease_old ← timer.nextRelease
      interval_secs ← interval_to_seconds(timer.interval)
    
    ACTION: on_checkin(capsule_id)
    
    AFTER:
      interval_secs ← interval_to_seconds(timer.interval)
      ASSERT timer.nextRelease == now() + interval_secs
      ASSERT timer.nextRelease > nextRelease_old (timer extended)
      
      IF state == 'GRACE_PERIOD':
        ASSERT state → 'ACTIVE'
        ASSERT graceEndsAt == NULL (grace period cancelled)
```

### Property 6: Content Hash Integrity

**Validates: Requirements 4, 30**

```
PROPERTY: content_hash_round_trip
  FOR ALL plaintext ∈ String:
    hash_1 ← SHA256(plaintext)
    hash_2 ← SHA256(plaintext)
    
    ASSERT hash_1 == hash_2 (deterministic)
    
  COROLLARY: Server can verify ciphertext integrity without decryption
    - On upload: contentHash = SHA256(plaintext)
    - On contact access: contact decrypts, recomputes hash
    - If hashes match, content not tampered
    - If hashes differ, content modified during storage (security alert)
```

---

## Correctness Properties

### Round-Trip Encryption

```
PROPERTY: encrypt_decrypt_round_trip
  FOR ALL plaintext ∈ String, passphrase ∈ String, interval ∈ {'DAILY', 'WEEKLY', 'MONTHLY'}:
    LET salt ← random_bytes(16)
    LET encrypted ← browser.encrypt(plaintext, passphrase, salt)
    LET { ciphertext, nonce } ← encrypted
    LET decrypted ← browser.decrypt(ciphertext, passphrase, salt, nonce)
    
    ASSERT decrypted == plaintext
    
  PROOF:
    - PBKDF2 is deterministic: derive(pass, salt, iterations=100k) always produces same key
    - AES-GCM is symmetric authenticated encryption
    - Same key + nonce used for both encrypt and decrypt
    - Authentication tag verification ensures ciphertext not tampered
    - Therefore: plaintext == decrypted
```

### Timer State Transitions

```
PROPERTY: timer_state_transitions_valid
  FOR ALL capsules:
    state ← capsule.timer.state
    nextRelease ← capsule.timer.nextRelease
    graceEndsAt ← capsule.timer.graceEndsAt
    
    CASE state == 'ACTIVE':
      ASSERT graceEndsAt == NULL
      ASSERT nextRelease > now()
      ASSERT no release links generated
    
    CASE state == 'GRACE_PERIOD':
      ASSERT nextRelease <= now()
      ASSERT graceEndsAt > now()
      ASSERT graceEndsAt == nextRelease + 7_days
    
    CASE state == 'RELEASED':
      ASSERT release links generated for all contacts
      ASSERT all email notifications sent
      ASSERT state is irreversible (cannot transition to ACTIVE or GRACE_PERIOD)
```

### Single-Use Release Link Tokens

```
PROPERTY: release_token_single_use
  FOR ALL tokens T in oneTimeTokens:
    ASSERT T.used == TRUE → (T.usedAt != NULL AND future_access(T) fails)
    ASSERT T.used == FALSE → future_access(T) succeeds at most once
    
  PROOF:
    - On first use: oneTimeTokens.used = TRUE, usedAt = NOW
    - On subsequent attempts: query finds used=TRUE, returns error
    - Tokens are unique: no two tokens are identical (256-bit entropy)
    - Therefore: each token usable exactly once
```

### Audit Log Tamper Detection

```
PROPERTY: audit_log_tamper_detection
  FOR ALL audit log entries E_i, E_{i+1}:
    LET hash_i ← SHA256(E_i.prevHash || E_i.data || E_i.seqNum)
    LET hash_{i+1} ← SHA256(E_{i+1}.prevHash || E_{i+1}.data || E_{i+1}.seqNum)
    
    ASSERT E_i.hash == hash_i (computed hash matches stored hash)
    ASSERT E_{i+1}.prevHash == E_i.hash (chain links correctly)
    
    IF E_i is modified after creation:
      LET new_hash_i ← SHA256(E_i.prevHash || E_i.modified_data || E_i.seqNum)
      ASSERT new_hash_i != E_i.hash (modification detected)
      ASSERT E_{i+1}.prevHash != new_hash_i (chain breaks)
      
    THEREFORE: any tampering is detectable
```

### Check-in Resets Timer

```
PROPERTY: checkin_resets_timer
  FOR ALL capsules WHERE state == 'ACTIVE' OR state == 'GRACE_PERIOD':
    BEFORE: nextRelease = T_old
    
    on_checkin(capsule_id)
    
    AFTER: nextRelease = now() + interval_duration
    ASSERT nextRelease == now() + interval_duration
    
    IF state == 'GRACE_PERIOD':
      ASSERT state changes to 'ACTIVE'
      ASSERT graceEndsAt becomes NULL
```

---

## Testing Strategy

### Unit Testing

```
TEST: Encryption Round-Trip
  plaintext ← "My important message"
  passphrase ← "secure-passphrase-123"
  salt ← random_bytes(16)
  
  encrypted ← encrypt(plaintext, passphrase, salt)
  decrypted ← decrypt(encrypted.ciphertext, passphrase, salt, encrypted.nonce)
  
  ASSERT decrypted == plaintext

TEST: PBKDF2 Determinism
  passphrase ← "test-passphrase"
  salt ← hex"0123456789abcdef0123456789abcdef"
  
  key1 ← derive_key(passphrase, salt)
  key2 ← derive_key(passphrase, salt)
  
  ASSERT key1 == key2 (same input, same output)

TEST: Timer Calculation
  lastCheckin ← "2024-01-01 12:00:00"
  interval ← 'WEEKLY'
  
  nextRelease ← calculate_next_release(lastCheckin, interval)
  
  ASSERT nextRelease == "2024-01-08 12:00:00"

TEST: Release Token Hashing
  token ← random_bytes(32)
  tokenHash1 ← hash_token(token)
  tokenHash2 ← hash_token(token)
  
  ASSERT tokenHash1 == tokenHash2 (deterministic)
  ASSERT tokenHash1 != token (hashing, not identity)

TEST: Audit Hash Chain Verification
  entries ← [entry1, entry2, entry3]
  
  FOR i in 0..len(entries)-1:
    expected_hash ← compute_hash(entries[i].prevHash || entries[i].data || i)
    ASSERT entries[i].hash == expected_hash

TEST: Contact Passphrase Hashing
  passphrase ← "contact-passphrase"
  hash1 ← bcrypt_hash(passphrase, 12)
  
  ASSERT bcrypt_verify(passphrase, hash1) == true
  ASSERT bcrypt_verify("wrong-passphrase", hash1) == false
```

### Integration Testing

```
TEST: Capsule Creation to Release Flow
  1. User logs in
  2. User creates capsule with passphrase, adds contact
  3. Timer is ACTIVE, nextRelease set
  4. Background job: 7 days elapsed, send warning email
  5. Background job: timer expires, transition to GRACE_PERIOD
  6. User checks in: timer resets to ACTIVE
  7. Background job: grace period expires (without check-in this time)
  8. Release triggered: release links generated, emails sent to contacts
  9. Contact uses release link with passphrase, decrypts content
  10. Audit log shows all events with correct hash chain

TEST: Multiple Check-ins Within Interval
  1. User checks in at T=0, nextRelease = T+7 days
  2. At T=2 days, user checks in again, nextRelease resets to T+2 days+7 days
  3. At T+5 days, timer expires (from second check-in)
  4. GRACE_PERIOD triggered
  5. At T+9 days (5+7 from grace), release triggered
  6. Audit log shows each check-in and state transition

TEST: Contact Attempts Multiple Access Attempts
  1. Release link sent to contact with token
  2. Contact uses link, enters passphrase, accesses capsule (marked used)
  3. Contact tries same link again: returns error "Link already used"
  4. Release link with new token cannot be generated (capsule released, immutable)
  5. Audit log shows access attempt and failure
```

### Demo Mode Validation

```
TEST: Demo Timer Acceleration (1000x)
  1. Create capsule with DAILY interval in demo mode
  2. Wait 86.4 seconds (real) = 86400 seconds (demo) = 1 day
  3. Assert timer expiration triggered
  4. Assert grace period: 7 days should expire in ~604 seconds

TEST: Demo Email Logging
  1. Enable demo mode
  2. Trigger capsule release
  3. Assert console logs "Email Send Event" with recipient, subject, body
  4. Assert no real SMTP send occurs
```

### Property-Based Testing (Using fast-check)

```
// Test: PBKDF2 derivation always produces same key for same input
test.prop([
  fc.string().filter(s => s.length > 0),  // passphrase
  fc.uint8Array({ minLength: 16, maxLength: 16 })  // salt
])(async (passphrase, salt) => {
  const key1 = await deriveKey(passphrase, salt);
  const key2 = await deriveKey(passphrase, salt);
  
  expect(key1).toEqual(key2);
});

// Test: Encryption with different passphrases produces different ciphertexts
test.prop([
  fc.string().filter(s => s.length > 0),  // plaintext
  fc.string().filter(s => s.length > 0 && s.length <= 100),  // pass1
  fc.string().filter(s => s.length > 0 && s.length <= 100 && s !== pass1)  // pass2
])(async (plaintext, pass1, pass2) => {
  const salt = new Uint8Array(16);
  const enc1 = await encrypt(plaintext, pass1, salt);
  const enc2 = await encrypt(plaintext, pass2, salt);
  
  expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
});

// Test: Decryption with wrong passphrase fails
test.prop([
  fc.string().filter(s => s.length > 0),  // plaintext
  fc.string().filter(s => s.length > 0),  // correct passphrase
  fc.string().filter(s => s.length > 0 && s !== correctPass)  // wrong passphrase
])(async (plaintext, correctPass, wrongPass) => {
  const salt = new Uint8Array(16);
  const encrypted = await encrypt(plaintext, correctPass, salt);
  
  await expect(
    decrypt(encrypted.ciphertext, wrongPass, salt, encrypted.nonce)
  ).rejects.toThrow();
});
```

---

## Performance Considerations

### Client-Side Encryption Performance

```
Operation: PBKDF2 Key Derivation (100,000 iterations)
  Time: ~200-500ms in browser (varies by device)
  Acceptable: Yes (happens once per encrypt/decrypt, user waits)
  
Operation: AES-GCM Encryption/Decryption
  Time: ~1-5ms for typical capsule (< 10MB)
  Acceptable: Yes (nearly instant)
  
Operation: SHA-256 Hash
  Time: < 1ms
  Acceptable: Yes

Optimization: Cache derived keys?
  NOT RECOMMENDED: Passphrases should not be stored in memory longer than necessary
  Trade-off: Security > performance
```

### Backend Performance

```
Endpoint: GET /capsules (fetch all user's capsules)
  Query: SELECT * FROM capsules WHERE userId = ? ORDER BY urgency
  Time: < 50ms (typical user has < 50 capsules)
  Optimization: Index on (userId, state, nextRelease)

Endpoint: POST /capsules/{id}/checkin
  Query: UPDATE timer, INSERT audit log entry
  Time: < 10ms
  Optimization: Single transaction

Background Job: Timer Checker (runs every 60s)
  Query: SELECT * FROM timers WHERE state != 'RELEASED' AND nextRelease <= NOW()
  Time: Scales with number of active capsules (N)
  Estimate: ~ 10-100ms for 10,000 capsules
  Optimization: Batch processing, B-tree index on nextRelease

Background Job: Email Queue Processor (runs every 5 minutes)
  Query: SELECT * FROM emailQueue WHERE sent = FALSE AND nextRetry <= NOW()
  Time: Depends on SMTP latency (varies, typically 1-5 seconds per email)
  Optimization: Async SMTP, concurrent sending (up to 10 parallel)
```

### Database Query Optimization

```
CREATE INDEX idx_capsules_user_state ON capsules(userId, releasedAt DESC);
CREATE INDEX idx_timers_active ON timers(state, nextRelease) WHERE state != 'RELEASED';
CREATE INDEX idx_contacts_capsule ON contacts(capsuleId);
CREATE INDEX idx_audit_resource ON auditLog(resourceId, timestamp DESC);
CREATE INDEX idx_audit_user ON auditLog(userId, timestamp DESC);
CREATE INDEX idx_email_queue_send ON emailQueue(sent, nextRetry) WHERE sent = FALSE;
```

---

## Deployment Architecture

### Environment Separation

```
DEVELOPMENT:
  FRONTEND: http://localhost:3000 (Vite dev server)
  BACKEND: http://localhost:3001 (Node server)
  DATABASE: localhost:5432 (PostgreSQL)
  DEMO_MODE: true
  TLS: disabled

STAGING:
  FRONTEND: https://staging.legacy-switch.com (Vercel)
  BACKEND: https://api-staging.legacy-switch.com (Fly.io)
  DATABASE: Managed PostgreSQL (Fly.io Postgres)
  DEMO_MODE: true (optional, for testing)
  TLS: enabled, self-signed or staging cert

PRODUCTION:
  FRONTEND: https://legacy-switch.com (Vercel)
  BACKEND: https://api.legacy-switch.com (Fly.io)
  DATABASE: Managed PostgreSQL (Fly.io Postgres, automated backups)
  DEMO_MODE: false
  TLS: enabled, production certificate
```

### Database Backup Strategy

```
Daily Automated Backups:
  - Time: 02:00 UTC
  - Retention: 30 days
  - Location: Separate encrypted storage (AWS S3 or similar)
  - Encryption: AES-256 with KMS key (separate from production DB key)
  - Verification: Monthly restore test

Backup Contents:
  - All tables (users, capsules, timers, contacts, releases, auditLog, emailQueue)
  - Database credentials: NOT backed up (managed separately via secrets)
  - Encryption keys: NOT backed up (passphrases not in database)

Restore Procedure (if disaster):
  1. Restore from latest backup to new PostgreSQL instance
  2. Verify audit log chain integrity
  3. Redirect app to new database
  4. Notify users of recovery (audit log preserved)
```

---

## Implementation Roadmap

### Phase 1 (MVP): Core Functionality
- [x] Requirements document (completed)
- [ ] Design document (this document - **WIP**)
- [ ] Database schema and migrations
- [ ] Backend authentication (signup, login, JWT)
- [ ] Backend capsule CRUD operations
- [ ] Frontend login/registration pages
- [ ] Frontend dashboard and capsule form
- [ ] Browser encryption (WebCrypto PBKDF2 + AES-GCM)
- [ ] Timer initialization and state machine
- [ ] Background job: timer checker
- [ ] Email notifications (using SendGrid or similar)
- [ ] Audit logging with hash chain
- [ ] Demo mode (1000x timer, demo account)
- [ ] Integration and end-to-end tests

### Phase 2 (Post-MVP): Polish & Security Hardening
- [ ] Rate limiting implementation (login, email sends)
- [ ] Advanced security: IP whitelisting, geographic anomalies
- [ ] Multi-language support (i18n)
- [ ] Video/media support in capsules (optional)
- [ ] Scheduled partial releases (advanced use case)
- [ ] User-to-user messaging (future feature)
- [ ] Mobile app (React Native or native apps)
- [ ] Biometric unlock (browser/device native)

---

## Deployment Checklist

```
PRE-DEPLOYMENT:
  ☐ All acceptance criteria tests pass
  ☐ Security audit completed (encryption, auth, audit log)
  ☐ Database migrations tested on staging
  ☐ Backup and restore procedure tested
  ☐ Performance testing completed (load test with 10k+ users)
  ☐ Penetration testing (if budget allows)
  ☐ Code review completed
  ☐ Documentation finalized
  ☐ Runbooks created (how to handle outages, data recovery, etc.)
  ☐ Monitoring/alerting configured

DEPLOYMENT DAY:
  ☐ Deploy backend to staging, verify all endpoints
  ☐ Deploy frontend to staging, verify all pages
  ☐ Smoke test: create capsule, check timer, receive email
  ☐ Deploy backend to production (blue-green or canary)
  ☐ Deploy frontend to production
  ☐ Verify production logs, no errors
  ☐ Spot check: create production capsule, verify encryption
  ☐ Set up monitoring dashboards
  ☐ Notify users of launch (email, landing page announcement)

POST-DEPLOYMENT:
  ☐ Monitor error logs for 24 hours
  ☐ Monitor database performance
  ☐ Verify background jobs running (timer checker, email queue)
  ☐ Gather user feedback
  ☐ Plan Phase 2 features
```

---

## Conclusion

This design provides a comprehensive architecture for Legacy Switch, prioritizing end-to-end encryption, immutable audit logging, and a robust timer-based release mechanism. The separation of frontend (React on Vercel) and backend (Node.js on Fly.io) with PostgreSQL database enables scalable, maintainable development. All cryptographic operations occur in the browser using WebCrypto API, ensuring the server never has access to plaintext capsule contents or user/contact passphrases.

The state machine for timer management (ACTIVE → GRACE_PERIOD → RELEASED) provides a 7-day grace period for accidental releases, while tamper-evident audit logging ensures transparency and compliance. Demo mode enables rapid testing and demonstration without waiting for real time intervals.

Security is built in at every layer: HTTPS, JWT authentication, bcrypt password hashing, AES-GCM authenticated encryption, one-time-use release links with 256-bit entropy, and rate limiting on sensitive endpoints.

The design is complete and ready for implementation following the task creation phase.
