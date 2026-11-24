# Requirements Document

## Introduction

Legacy Switch is a web-based dead man's switch application that enables users to securely store sensitive personal information in encrypted capsules and have that information automatically released to designated trusted contacts if the user stops actively checking in. The system prioritizes end-to-end encryption such that the server never has access to unencrypted capsule contents, combined with a simple timer-based release mechanism and clear warning notifications to encourage users to regularly confirm their active status.

This MVP delivers core functionality for email-based user accounts, capsule creation and management, browser-side encryption, check-in mechanics, trusted contact assignment, staged email warnings, an audit log for security events, and a demo mode for testing and demonstration purposes.

## Glossary

- **Capsule**: An encrypted container holding user personal information (text messages, files, instructions) that is released to designated contacts upon timer expiration
- **User**: An individual account holder who creates and manages capsules
- **Trusted Contact**: A designated person who can receive and open released capsules via a one-time-use link
- **Check-in**: The action by which a User confirms active status and extends the timer
- **Timer**: A countdown mechanism that tracks elapsed time since the User's last check-in; upon expiration plus grace period, triggers capsule release
- **Check-in Interval**: The configurable period (daily, weekly, monthly) that defines the timer reset duration
- **Grace Period**: The 7-day window after timer expiration during which the User can still check in to prevent release
- **Release Link**: A one-time-use URL containing a unique 32-byte random token that grants a Trusted Contact access to an opened capsule
- **Passphrase**: A user-defined string used for client-side key derivation via PBKDF2 to encrypt and decrypt capsule contents
- **Audit Log**: An immutable, append-only record of all security-relevant events (login, capsule creation, contact notification, release, access attempts)
- **Demo Mode**: An operational mode with accelerated timers (1000x speed), demo account credentials, and console logging instead of real email delivery
- **WebCrypto API**: The browser's native cryptographic API used for PBKDF2 key derivation and AES-GCM encryption/decryption
- **PBKDF2**: Password-Based Key Derivation Function 2; used to derive encryption keys from user passphrases with 100,000 iterations
- **AES-GCM**: Advanced Encryption Standard in Galois/Counter Mode; symmetric encryption algorithm providing authenticated encryption
- **Tamper-Evident Hash Chain**: A chain of cryptographic hashes linking consecutive audit log entries such that any modification to prior entries is detectable

---

## Requirements

### Requirement 1: User Account Registration and Login

**User Story:** As a user, I want to create an account with email and password, so that I can securely access my legacy capsules.

#### Acceptance Criteria

1. WHEN a user submits a registration form with a valid email address and password, THE System SHALL create a user account and store the password using bcrypt hashing with salt
2. WHEN registration completes successfully, THE System SHALL send a confirmation email to the provided address
3. WHEN a user provides correct email and password at login, THE System SHALL authenticate the user and issue a session token valid for the user's browser session
4. WHEN a user provides incorrect credentials, THE System SHALL deny access and return a generic error message (not revealing whether email or password was wrong)
5. WHEN a user attempts to register with an email address already associated with an account, THE System SHALL return an error without creating a duplicate account

#### Security Considerations
- Passwords must be bcrypt-hashed with a minimum of 12 salt rounds
- Login attempts should be logged in the Audit Log
- Session tokens should be httpOnly cookies to prevent XSS exfiltration
- Email verification may be deferred to Phase 2; MVP may auto-confirm registrations

---

### Requirement 2: Capsule Creation

**User Story:** As a user, I want to create a new encrypted capsule, so that I can store important personal information securely.

#### Acceptance Criteria

1. WHEN a user is authenticated and selects "Create Capsule," THE System SHALL present a form to enter capsule title, description, and content (text and optional files)
2. WHEN a user enters capsule content and selects a passphrase, THE System SHALL derive an encryption key from the passphrase using PBKDF2 (100,000 iterations, SHA-256) in the browser
3. WHEN a user encrypts a capsule, THE System SHALL use AES-GCM-256 to encrypt the capsule content and store only the ciphertext on the server
4. WHEN capsule creation completes, THE System SHALL log the capsule creation event (title, timestamp, file count) in the Audit Log without storing file contents
5. WHEN a user uploads file attachments to a capsule, THE System SHALL accept files up to 10 MB per file, with a total capsule payload not exceeding 100 MB

#### Security Considerations
- All encryption operations must occur in the browser; the server receives only ciphertext
- The passphrase must never be transmitted to or stored on the server
- Key derivation and encryption must use the WebCrypto API
- Audit Log must record capsule creation without revealing content

---

### Requirement 3: Passphrase-Based Encryption with PBKDF2

**User Story:** As a user, I want to protect my capsule with a passphrase that only I know, so that only trusted contacts with the passphrase can open my capsule.

#### Acceptance Criteria

1. WHEN a user creates a capsule, THE Encryption_Engine SHALL derive a unique 256-bit encryption key from the user-supplied passphrase using PBKDF2 with 100,000 iterations and SHA-256
2. WHEN the same passphrase is supplied again, THE Encryption_Engine SHALL derive an identical encryption key (round-trip property: derive(passphrase) on iteration N equals derive(passphrase) on iteration N+M)
3. WHEN different passphrases are supplied for the same capsule, THE Encryption_Engine SHALL derive different encryption keys
4. WHEN PBKDF2 key derivation completes in the browser, THE System SHALL never transmit the passphrase to the server
5. WHEN a user opens an existing capsule, THE Encryption_Engine SHALL accept the passphrase, derive the encryption key using PBKDF2, and decrypt the ciphertext in the browser

#### Security Considerations
- PBKDF2 must use 100,000 iterations as a minimum to withstand brute-force attacks
- Salt should be randomly generated and stored with the ciphertext
- The passphrase is distinct from the user's account password
- Passphrases should be at least 8 characters (enforced client-side, documented server-side)

---

### Requirement 4: AES-GCM Encryption and Decryption

**User Story:** As the system, I want to encrypt capsule contents using AES-GCM, so that capsule contents are authenticated and protected from tampering.

#### Acceptance Criteria

1. WHEN a capsule is encrypted, THE Encryption_Engine SHALL use AES-GCM-256 with a 96-bit randomly generated nonce to encrypt the content and produce authenticated ciphertext
2. WHEN a capsule is decrypted with the correct key, THE Encryption_Engine SHALL verify the authentication tag and return plaintext; if the tag is invalid, decryption SHALL fail with an authentication error
3. WHEN ciphertext is stored and retrieved from the server, THE Encryption_Engine SHALL decrypt it in the browser using the same key and nonce, producing the original plaintext (round-trip property: encrypt(plaintext) → store → retrieve → decrypt equals plaintext)
4. WHEN a trusted contact opens a released capsule with an incorrect passphrase, THE Encryption_Engine SHALL fail to verify the authentication tag and return a decryption error
5. THE Encryption_Engine SHALL generate a new random nonce for each encryption operation

#### Security Considerations
- Nonces must be truly random and never reused with the same key
- Authentication tags ensure capsule integrity and prevent undetected tampering
- Decryption failures must not reveal whether the passphrase or ciphertext was invalid
- The WebCrypto API's SubtleCrypto interface must be used for all encryption/decryption

---

### Requirement 5: Check-in and Timer Extension

**User Story:** As a user, I want to click a "Check-in" button to confirm I'm alive and extend the timer, so that my capsules are not released prematurely.

#### Acceptance Criteria

1. WHEN a user clicks "Check-in," THE Timer_Engine SHALL record the current timestamp and reset the timer to the configured Check-in Interval (daily, weekly, or monthly)
2. WHEN a check-in occurs, THE System SHALL update the user's last check-in timestamp in the database and log the check-in event in the Audit Log
3. WHEN the timer is active and the user has checked in within the interval, THE Timer_Engine SHALL display the time remaining until expiration
4. WHEN the check-in interval has elapsed and the user has not checked in, THE Timer_Engine SHALL transition to grace period state
5. WHEN a user checks in during the grace period (before the grace period expires), THE Timer_Engine SHALL cancel the pending release and reset the timer to the configured interval

#### Security Considerations
- Check-in timestamps must be recorded server-side to prevent client-side manipulation
- Grace period should be exactly 7 days
- All check-ins must be logged in the Audit Log
- Timers must be tamper-evident; changing timer state without a check-in must be auditable

---

### Requirement 6: Check-in Interval Configuration

**User Story:** As a user, I want to choose a check-in interval (daily, weekly, monthly), so that the release schedule matches my lifestyle and risk tolerance.

#### Acceptance Criteria

1. WHEN a user creates a capsule, THE System SHALL allow selection of check-in interval: daily (24 hours), weekly (7 days), or monthly (30 days)
2. WHEN a user updates a capsule's check-in interval, THE System SHALL apply the new interval to future timer resets
3. WHEN a user views a capsule, THE Dashboard SHALL display the configured check-in interval and time remaining until release
4. WHERE a capsule does not have an interval configured, THE System SHALL default to weekly
5. WHEN the timer reaches expiration plus grace period, THE System SHALL release the capsule regardless of interval configuration

#### Security Considerations
- Interval changes should be logged in the Audit Log
- Interval values must be validated server-side
- Changing an interval mid-cycle should not alter the current timer state

---

### Requirement 7: Grace Period Before Automatic Release

**User Story:** As a user, I want a 7-day grace period after my timer expires, so that I have time to check in and prevent an accidental release.

#### Acceptance Criteria

1. WHEN a user does not check in by the timer expiration time, THE Timer_Engine SHALL transition to grace period state and begin a 7-day countdown
2. WHEN in grace period state, THE Dashboard SHALL prominently display that release is imminent and provide a clear "Check In Now" button
3. WHEN a user checks in during grace period, THE Timer_Engine SHALL cancel the grace period and reset the timer to the configured interval
4. WHEN the grace period expires without a check-in, THE Release_Engine SHALL automatically trigger capsule release to all assigned Trusted Contacts
5. WHEN release is triggered, THE System SHALL generate one-time-use Release Links for each Trusted Contact and send them via email notification

#### Security Considerations
- Grace period state transitions must be logged in the Audit Log
- Release must be idempotent; multiple triggers for the same capsule must not send duplicate notifications
- Grace period must be exactly 7 days with server-side verification

---

### Requirement 8: Trusted Contact Assignment

**User Story:** As a user, I want to assign trusted contacts to a capsule and provide them with a passphrase, so that they can open the capsule when it is released.

#### Acceptance Criteria

1. WHEN a user creates or edits a capsule, THE System SHALL allow adding trusted contacts by email address
2. WHEN a user assigns a trusted contact, THE System SHALL require the user to provide a passphrase for that contact (may be the same as or different from the capsule encryption passphrase)
3. WHEN a contact is added, THE System SHALL store the contact email, the contact-specific passphrase (hashed), and the capsule association, without storing the passphrase in plaintext
4. WHEN a user views a capsule, THE Dashboard SHALL list all assigned Trusted Contacts and their status (not yet released, released, accessed)
5. WHEN a user removes a trusted contact from a capsule, THE System SHALL prevent the contact from receiving release notifications for that capsule and log the removal in the Audit Log

#### Security Considerations
- Contact-specific passphrases must be hashed and never stored in plaintext
- Each contact may have a different passphrase if desired
- Contact assignment changes must be logged in the Audit Log
- Contacts should not be able to view or modify the capsule before release

---

### Requirement 9: One-Time-Use Release Links

**User Story:** As a trusted contact, I want to receive a unique one-time-use link, so that only I can open my assigned capsule and the link cannot be reused by others.

#### Acceptance Criteria

1. WHEN a capsule is released to a trusted contact, THE Release_Engine SHALL generate a unique 32-byte random token for that contact
2. WHEN a Release Link containing the token is generated, THE System SHALL store the token and associate it with the contact and capsule, marking it as "unused"
3. WHEN a trusted contact accesses a Release Link, THE System SHALL verify the token against the stored unused tokens and grant access to the capsule
4. WHEN a trusted contact successfully opens a capsule via a Release Link, THE System SHALL mark that link as "used" and prevent any further use of that link
5. WHEN a trusted contact attempts to reuse an already-consumed Release Link, THE System SHALL deny access and return an error

#### Security Considerations
- Tokens must be cryptographically random and of sufficient length (32 bytes = 256 bits)
- Tokens should be transmitted via URL only (not in query parameters, or use HTTPS POST if possible)
- Token verification must occur server-side
- Each contact must have a unique token per capsule release; re-releasing a capsule must generate new tokens
- Audit Log must record all Release Link access attempts (successful and failed)

---

### Requirement 10: Email Notifications with Staged Warnings

**User Story:** As a user, I want to receive email reminders before my capsule is released, so that I have clear notice and can check in if needed.

#### Acceptance Criteria

1. WHEN a capsule timer reaches 7 days until expiration, THE Email_Engine SHALL send a "Warning: Your capsule will release in 7 days" email to the user with a clear "Check In Now" link
2. WHEN a capsule timer reaches 3 days until expiration and the user has not checked in, THE Email_Engine SHALL send a "Final Notice: Your capsule will release in 3 days" email to the user with a prominent "Check In Now" call-to-action
3. WHEN a capsule is released to trusted contacts, THE Email_Engine SHALL send a Release Notification email to each contact, including the one-time-use Release Link and instructions to open the capsule
4. WHEN a trusted contact opens a released capsule, THE Email_Engine SHALL send a Confirmation email to the original user (if still active or if capsule specifies it) indicating that the capsule was accessed and by whom
5. WHERE Demo Mode is enabled, THE System SHALL log all email notifications to the browser console instead of sending actual emails

#### Security Considerations
- Warning emails must include a "Check In" link that is easy to access and secure (authenticated)
- Release notification emails must clearly state that the link is one-time-use
- Email content must not reveal the actual contents of the capsule
- All email sends must be logged in the Audit Log with timestamp, recipient, and email type
- Emails sent during Demo Mode should include "[DEMO]" prefix in subject line

---

### Requirement 11: Dashboard and Timer Display

**User Story:** As a user, I want to view my capsules and their timer status on a dashboard, so that I can easily see which capsules need attention and check in when needed.

#### Acceptance Criteria

1. WHEN a user is logged in, THE Dashboard SHALL display all capsules owned by that user, sorted by urgency (time remaining until release)
2. WHEN a capsule is displayed, THE Dashboard SHALL show the capsule title, check-in interval, time remaining until expiration, timer state (active, in grace period, released), and a "Check In" button if the timer is active
3. WHERE a capsule timer is in grace period state, THE Dashboard SHALL display the time remaining in grace period with a warning indicator (e.g., red color, urgent icon)
4. WHEN a user hovers over or expands a capsule, THE Dashboard SHALL display the Visual Candle metaphor: a visual indicator showing urgency based on timer depletion (e.g., candle flame height decreases as timer depletes)
5. WHEN a user clicks "Check In," THE System SHALL immediately update the timer display to reflect the reset

#### Security Considerations
- Dashboard must not reveal encrypted capsule contents
- Candle metaphor should be purely visual and not affect any security mechanics
- Timer display must be accurate within 1 minute
- Dashboard should refresh timer state at least every 60 seconds (or more frequently during grace period)

---

### Requirement 12: Visual Candle Metaphor for Urgency

**User Story:** As a user, I want a visual metaphor that shows how urgently my capsule will be released, so that I intuitively understand the remaining time without reading numbers.

#### Acceptance Criteria

1. WHEN a capsule is displayed on the Dashboard, THE UI SHALL render a visual candle metaphor with flame height proportional to time remaining
2. WHEN timer is at 100% of interval, THE Candle SHALL show full height (e.g., 100% flame)
3. WHEN timer is at 50% of interval, THE Candle SHALL show half height (e.g., 50% flame)
4. WHEN timer enters grace period, THE Candle SHALL change color to orange or red and flame shall be minimal (e.g., 10% flame)
5. WHEN timer is at 0% and grace period has expired (release triggered), THE Candle SHALL extinguish (fully consumed)

#### Security Considerations
- Candle metaphor is purely cosmetic and must not be relied upon for security-critical information
- Time-remaining must also be displayed numerically for accessibility
- Candle animations should be smooth but not distract from urgent warnings

---

### Requirement 13: Audit Log and Event Recording

**User Story:** As the system, I want to record all security-relevant events in an immutable audit log, so that security incidents can be investigated and the system's integrity verified.

#### Acceptance Criteria

1. WHEN a security-relevant event occurs (user login, capsule creation, capsule encryption, check-in, contact assignment, release, access attempt, capsule deletion), THE Audit_Logger SHALL append an event record to the audit log
2. WHEN an event is logged, THE Audit_Logger SHALL record: event type, timestamp (UTC), user ID, affected resource (capsule ID or contact ID), event outcome (success/failure), and any error message
3. WHEN a new audit log entry is appended, THE Audit_Logger SHALL compute a SHA-256 hash of the new entry and chain it to the previous entry's hash, creating a tamper-evident hash chain
4. WHEN the audit log is accessed, THE System SHALL allow authorized users to retrieve and inspect the audit log, verifying the hash chain to detect any tampering
5. WHEN an audit log entry is retrieved, THE System SHALL return the event details, the entry's hash, and the previous entry's hash to allow external verification of the chain

#### Security Considerations
- Audit log must be append-only; existing entries must not be modifiable or deletable
- Hash chain must use SHA-256 and must include the previous entry's hash and a sequence number
- Audit log queries must be restricted to the resource owner or administrators
- Audit log must be stored separately from the main application database if possible (or use a separate table with stricter access controls)
- Tamper-evident hash chain provides evidence of unauthorized modifications

---

### Requirement 14: Tamper-Evident Hash Chain for Audit Log

**User Story:** As an auditor or investigator, I want to verify that the audit log has not been tampered with, so that I can trust the security event record.

#### Acceptance Criteria

1. WHEN each audit log entry is appended, THE Hash_Chain SHALL compute: hash(entry_N) = SHA-256(previous_hash || entry_N_data || sequence_number_N)
2. WHEN two consecutive audit log entries are retrieved, THE Hash_Chain SHALL allow verification that entry_N+1's previous hash matches entry_N's hash, proving no tampering between them
3. WHEN the entire audit log is retrieved, THE Hash_Chain SHALL allow an external verifier to recompute all hashes and detect any insertion, deletion, or modification of prior entries
4. WHEN any entry in the audit log is modified, the hash of that entry and all subsequent entries' previous_hash values will be incorrect, making tampering detectable (round-trip property: verify_hash_chain(log) == true before tampering, false after)
5. WHERE a hash mismatch is detected, THE System SHALL log a security alert and prevent further modifications to the audit log until investigated

#### Security Considerations
- Hash chain provides evidence of tampering, not prevention; use with database-level access controls
- Hash chain is cryptographic evidence suitable for legal/forensic investigation
- Previous hash must be included in each entry's hash to create the chain
- Sequence numbers must be monotonically increasing and cannot be reused

---

### Requirement 15: Immutable Audit Log Storage

**User Story:** As a system administrator, I want audit log entries to be immutable, so that audit records cannot be modified or deleted even by privileged users.

#### Acceptance Criteria

1. WHEN an audit log entry is written to the database, THE System SHALL prevent any UPDATE or DELETE operations on that entry
2. WHEN an administrator attempts to delete or modify an audit log entry, THE System SHALL deny the operation and log the failed attempt as a security event
3. WHERE the application needs to correct an audit log error, THE System SHALL create a new audit log entry documenting the correction (correction via append, not modification)
4. WHEN the audit log table is accessed by any service or user, THE Database_Layer SHALL enforce strict write-once semantics (INSERT only, no UPDATE or DELETE)
5. WHEN audit log entries are archived (moved to cold storage), THE System SHALL preserve the hash chain integrity and prevent modifications to archived entries

#### Security Considerations
- Database constraints or stored procedures should enforce write-once semantics
- Audit log entries should never be physically deleted; they can be archived but never removed
- Application code must never attempt to UPDATE or DELETE audit log entries
- Corrections to events (if needed) must be recorded as separate entries appended to the log

---

### Requirement 16: User Dashboard and Capsule Management

**User Story:** As a user, I want to view, edit, and manage all my capsules from a central dashboard, so that I can keep my legacy information current and ensure correct contacts are assigned.

#### Acceptance Criteria

1. WHEN a user is logged in, THE Dashboard SHALL display all capsules owned by that user, with options to view details, edit, or delete each capsule
2. WHEN a user clicks "Edit Capsule," THE System SHALL allow the user to update the capsule title, description, content, check-in interval, and trusted contacts
3. WHEN a user updates a capsule after it has been created, THE System SHALL re-encrypt the new content with the same passphrase (or a new one if changed), and log the edit in the Audit Log
4. WHEN a user deletes a capsule, THE System SHALL remove the capsule and all associated data, log the deletion in the Audit Log, and prevent release links for that capsule from functioning
5. WHEN a user views the Dashboard, THE System SHALL display check-in history (last 5 check-ins) and upcoming email notification schedule (e.g., "Warning email in 5 days")

#### Security Considerations
- Edit operations on encrypted capsules should perform re-encryption in the browser
- Deletes should be logged with timestamp and cannot be undone
- Contacts should not be able to view the original capsule contents via the Dashboard
- Check-in history should not reveal granular time information that could be used to infer user patterns (rounded to hour)

---

### Requirement 17: Check-in History

**User Story:** As a user, I want to see my check-in history, so that I can review my compliance with the check-in schedule and understand my timer state.

#### Acceptance Criteria

1. WHEN a user views the Dashboard, THE System SHALL display the user's last 5 check-in timestamps (or fewer if fewer than 5 exist)
2. WHEN a user clicks "View Full History," THE System SHALL display all check-in timestamps for the user (optionally paginated)
3. WHEN a check-in history is displayed, THE System SHALL show timestamps in the user's local timezone (retrieved from browser or account settings)
4. WHEN a user hovers over or clicks a check-in timestamp, THE System SHALL display the capsules affected by that check-in and the time interval that was set
5. WHERE a user has never checked in, THE System SHALL display "No check-ins yet" and suggest checking in to prevent release

#### Security Considerations
- Check-in timestamps should be rounded to the nearest hour to prevent timing attacks
- Full history should be restricted to the resource owner
- Check-in history should be audited for access (who viewed the history)
- Excessively frequent API calls to check history should be rate-limited

---

### Requirement 18: Demo Mode for Testing and Demonstration

**User Story:** As a hackathon judge or demo user, I want to use an accelerated demo mode with pre-populated data, so that I can quickly see the system in action without waiting for real timers.

#### Acceptance Criteria

1. WHEN Demo Mode is enabled (via environment variable or flag), THE System SHALL:
   - Create or reuse a demo account with email "judge@demo.local" and password "demo"
   - Accelerate all timers by 1000x (1 day becomes 1 minute, 7-day grace period becomes 25 seconds)
   - Log email sends to browser console instead of sending real emails
   - Prepopulate the demo account with 3 sample capsules at different timer states (active, in grace period, released)

2. WHEN a user logs into the demo account in Demo Mode, THE Dashboard SHALL display the pre-populated capsules with realistic but accelerated timers

3. WHEN Demo Mode is active, THE System SHALL:
   - Prefix all console logs with "[DEMO]" for clarity
   - Log all timer transitions (expiration, grace period start, release) to the browser console
   - Log all email notifications to the browser console with subject and recipient

4. WHEN a demo capsule timer reaches expiration or grace period in Demo Mode, THE System SHALL automatically log this event to the console (no user action needed to observe)

5. WHERE Demo Mode is enabled, THE System SHALL NOT send real emails and SHALL NOT use real SMTP or email service

#### Security Considerations
- Demo Mode should only be active in development/staging environments; production must not use Demo Mode
- Demo account must have a non-production email address (judge@demo.local)
- Pre-populated demo data must be clearly labeled as such
- Demo Mode timers must not interfere with real production timers
- Console logging of demo events must not leak sensitive data (e.g., passphrases, encryption keys)

---

### Requirement 19: Browser-Side Cryptographic Operations

**User Story:** As the system, I want all encryption and decryption to happen in the user's browser, so that the server never has access to unencrypted capsule contents.

#### Acceptance Criteria

1. WHEN a user creates or edits a capsule, THE Encryption_Engine SHALL perform PBKDF2 key derivation and AES-GCM encryption entirely in the browser using the WebCrypto API
2. WHEN a capsule is submitted for storage, THE System SHALL send only the ciphertext, nonce, and salt to the server; the passphrase and plaintext must never leave the browser
3. WHEN a user opens an encrypted capsule for editing, THE System SHALL retrieve the ciphertext from the server and perform decryption in the browser before displaying content
4. WHEN a trusted contact accesses a released capsule via a Release Link, THE System SHALL retrieve the ciphertext and require the contact to supply the passphrase; decryption SHALL occur in the contact's browser using the WebCrypto API
5. WHEN a user's browser is closed, the plaintext and all in-memory encryption keys SHALL be cleared from memory and not retained in browser storage

#### Security Considerations
- JavaScript must not be served over HTTP; only HTTPS must be used to prevent MITM attacks
- WebCrypto API usage must follow best practices (no polyfills; use native browser API)
- Passphrases and plaintext must not be logged to console in production
- CSP (Content Security Policy) headers should prevent inline script execution and restrict script sources
- LocalStorage must not be used for sensitive data; use in-memory variables or sessionStorage if necessary (with caution)

---

### Requirement 20: One-Time Session Tokens for Contact Access

**User Story:** As a trusted contact, I want to access a released capsule via a secure one-time link, so that I can read the user's legacy information with confidence that the link is unique to me.

#### Acceptance Criteria

1. WHEN a capsule is released, THE Release_Engine SHALL generate unique session tokens (distinct from Release Link tokens) for each trusted contact
2. WHEN a trusted contact uses a Release Link, THE System SHALL require the contact to supply the contact-specific passphrase
3. WHEN the passphrase is correct, THE System SHALL issue a temporary session token valid for 1 hour (or the duration of the browser session, whichever is shorter)
4. WHEN the session token expires, THE System SHALL require the contact to use the Release Link again to regain access; they SHALL NOT be able to open the capsule without re-supplying the passphrase
5. WHERE a trusted contact attempts to access the capsule without a valid session token or Release Link, THE System SHALL deny access and log the failed attempt in the Audit Log

#### Security Considerations
- Session tokens should be short-lived (max 1 hour)
- Tokens must not be reusable across different releases of the same capsule
- Each contact should have only one active session per capsule release
- Session tokens should be httpOnly cookies (not in URL or localStorage) to prevent XSS
- Failed access attempts must be logged and may trigger account suspension after threshold (e.g., 10 failed attempts)

---

### Requirement 21: Password Hashing and Storage Security

**User Story:** As the system, I want to hash and securely store user passwords, so that even if the database is compromised, attackers cannot recover plaintext passwords.

#### Acceptance Criteria

1. WHEN a user registers or updates their password, THE System SHALL hash the password using bcrypt with a minimum of 12 salt rounds
2. WHEN a user attempts to log in, THE System SHALL compare the provided password against the stored bcrypt hash using a constant-time comparison function
3. WHEN a password is hashed, THE System SHALL store only the bcrypt hash in the database; the plaintext password must never be stored
4. WHEN a user requests a password reset, THE System SHALL send a time-limited password reset link (valid for 1 hour) and not perform a password reset without explicit user confirmation
5. WHEN a password reset link expires or is used once, THE System SHALL invalidate it to prevent reuse

#### Security Considerations
- Bcrypt must use 12+ salt rounds for strong security
- Password comparison must be constant-time to prevent timing attacks
- Password reset tokens must be cryptographically random (32+ bytes)
- Password reset links must be one-time-use
- Failed login attempts may be rate-limited to prevent brute-force attacks

---

### Requirement 22: Session Management and Timeout

**User Story:** As the system, I want to automatically log out inactive users, so that abandoned sessions cannot be exploited.

#### Acceptance Criteria

1. WHEN a user logs in, THE Session_Manager SHALL create a session valid for 24 hours
2. WHEN a user is inactive (no requests for 30 minutes), THE Session_Manager SHALL invalidate the session and require re-authentication
3. WHEN a user logs out explicitly, THE Session_Manager SHALL immediately invalidate the session and clear session cookies
4. WHEN a session is invalidated, THE System SHALL remove all associated session data from memory and database
5. WHEN a session expires or is invalidated, THE System SHALL redirect the user to the login page

#### Security Considerations
- Session timeout should be 30 minutes of inactivity, with an absolute max of 24 hours
- Session cookies must be httpOnly and Secure flags enabled
- Session IDs must be cryptographically random
- Multiple concurrent sessions per user may be allowed but should be logged

---

### Requirement 23: Secure Email Delivery for Notifications

**User Story:** As the system, I want to send security notifications via email to users and contacts, so that they receive timely and reliable information.

#### Acceptance Criteria

1. WHEN a warning or release notification must be sent, THE Email_Engine SHALL queue the email for delivery and attempt sending via a configured SMTP provider (or mock in Demo Mode)
2. WHEN an email is sent, THE System SHALL log the send event in the Audit Log, including recipient, subject, timestamp, and whether send was successful
3. WHEN an email send fails (e.g., SMTP timeout), THE System SHALL retry up to 3 times with exponential backoff (1 minute, 5 minutes, 15 minutes)
4. WHEN an email is successfully delivered, THE System SHALL mark the event in Audit Log as successful; failed sends after retries SHALL be marked as failed
5. WHERE Demo Mode is active, THE System SHALL log email content to console instead of sending

#### Security Considerations
- SMTP credentials must be stored securely (environment variables or secrets vault, not in code)
- Email content must not contain sensitive information (e.g., plaintext capsule contents)
- SPF, DKIM, and DMARC records should be configured for the email domain to prevent spoofing
- Sent emails should include headers and footers identifying them as automated notifications

---

### Requirement 24: Input Validation and Sanitization

**User Story:** As the system, I want to validate and sanitize all user inputs, so that invalid data does not corrupt the system and malicious input is rejected.

#### Acceptance Criteria

1. WHEN a user submits capsule content (text or files), THE Input_Validator SHALL check that the text is valid UTF-8 and files do not exceed size limits (10 MB per file, 100 MB total)
2. WHEN a user enters an email address, THE Input_Validator SHALL validate the format using a standard email regex and confirm it matches RFC 5322
3. WHEN a user supplies a passphrase, THE Input_Validator SHALL enforce a minimum length of 8 characters and reject passphrases with invalid characters (client-side suggestion; server-side enforcement)
4. WHEN a user enters capsule title or description, THE Input_Validator SHALL sanitize HTML/script content to prevent XSS (or disallow HTML entirely)
5. WHEN invalid input is detected, THE System SHALL return a clear, user-friendly error message indicating the problem without revealing system internals

#### Security Considerations
- Input validation must occur both client-side (UX) and server-side (security)
- Server-side validation must be strict; client-side validation can be lenient for UX
- Sanitization should remove or encode HTML/script tags if rich text is not intended
- File uploads should be scanned for malware (optional, Phase 2+)

---

### Requirement 25: HTTPS and Transport Security

**User Story:** As the system, I want all communications to use HTTPS encryption, so that user data in transit is protected from eavesdropping.

#### Acceptance Criteria

1. THE System SHALL use only HTTPS (TLS 1.2 or higher) for all communications between the browser and server; HTTP must be disabled or redirected to HTTPS
2. WHEN a user accesses the system via HTTP, THE System SHALL automatically redirect to HTTPS
3. WHEN HTTPS is used, THE System SHALL present a valid, unexpired SSL/TLS certificate issued by a trusted Certificate Authority
4. WHEN HTTPS is configured, THE System SHALL include HSTS (HTTP Strict-Transport-Security) headers with a max-age of at least 31536000 seconds (1 year)
5. WHEN a client connects via HTTPS, THE System SHALL negotiate a cipher suite with strong encryption (e.g., TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 or equivalent)

#### Security Considerations
- HTTPS is mandatory for security of all sensitive operations
- HSTS header should include the `includeSubDomains` flag if subdomains are in use
- SSL/TLS certificates should be renewed before expiration (automated via Let's Encrypt or similar)
- Mixed content (HTTPS page loading HTTP resources) must not occur

---

### Requirement 26: Error Handling and Logging

**User Story:** As the system, I want to handle errors gracefully and log them for debugging, so that users receive helpful feedback and engineers can diagnose issues.

#### Acceptance Criteria

1. WHEN an error occurs (network failure, decryption failure, server error), THE System SHALL:
   - Display a user-friendly error message in the UI (not raw exception stack traces)
   - Log the error server-side with timestamp, error type, affected user/resource, and stack trace
   - Assign the error a unique error ID for support reference

2. WHEN a user encounters an error, THE UI SHALL display the error ID and suggest next steps (e.g., "Try again later" or "Contact support with this error ID")

3. WHEN errors are logged server-side, THE Logging_Engine SHALL write to a secure log file or centralized logging service with appropriate access controls

4. WHEN a critical security error occurs (e.g., failed audit log hash chain verification), THE System SHALL immediately alert administrators and log to Audit Log

5. WHEN debugging is enabled (development mode), THE System SHALL log verbose details to console; in production, logging should be minimal to avoid leaking sensitive information

#### Security Considerations
- Error messages must not reveal sensitive information (e.g., database structure, internal paths)
- Stack traces must not be shown to end users
- Error IDs should be non-sequential (use UUID) to prevent enumeration
- Logging must comply with privacy regulations (no plaintext passwords, encryption keys, or sensitive data in logs)

---

### Requirement 27: Data Persistence and Database Integrity

**User Story:** As the system, I want to reliably store user data, capsules, and audit logs in a database, so that data is not lost and can be retrieved when needed.

#### Acceptance Criteria

1. WHEN a user creates an account, capsule, or check-in event, THE Database SHALL persist the data to a durable storage system with ACID guarantees
2. WHEN data is written to the database, THE System SHALL confirm successful write before acknowledging to the user
3. WHEN a database error occurs (connection loss, constraint violation), THE System SHALL handle the error gracefully, retry if appropriate, and log the event in Audit Log
4. WHEN capsule data is retrieved, THE System SHALL verify that ciphertext integrity has not been compromised (checksum or similar)
5. WHEN database backups are performed, THE System SHALL ensure backups are encrypted and stored securely, separate from the primary database

#### Security Considerations
- Database credentials must be stored in environment variables or secrets vault, not in code
- Database backups should be encrypted with a key separate from the production database
- Sensitive data in backups should be redacted or encrypted separately
- Database access should be restricted to application code; direct SQL queries must not be possible
- SQL injection prevention: use parameterized queries for all database operations

---

### Requirement 28: Release Link Token Generation and Validation

**User Story:** As the system, I want to generate and validate unique release link tokens, so that only the intended trusted contact can access a released capsule.

#### Acceptance Criteria

1. WHEN a capsule is released, THE Release_Engine SHALL generate a unique 32-byte random token for each trusted contact using a cryptographically secure random number generator
2. WHEN a token is generated, THE System SHALL store the token (hashed, not plaintext) in the database associated with the contact and capsule
3. WHEN a trusted contact accesses a Release Link containing a token, THE System SHALL:
   - Retrieve the token from the URL
   - Hash the provided token using the same hash function
   - Compare the hashed token against the stored hashed token (constant-time comparison)
   - If valid and unused, mark the token as "used" and proceed to contact authentication

4. WHEN a token is marked as "used," THE System SHALL prevent any further use of that token (re-access to the Release Link must generate a new Release Link)

5. WHEN a token is invalid or already used, THE System SHALL deny access and log the failed attempt without revealing why (generic error message)

#### Security Considerations
- Tokens must be cryptographically random (use /dev/urandom or similar)
- Tokens must be at least 32 bytes (256 bits) for sufficient entropy
- Tokens must be hashed in the database; plaintext tokens should never be stored
- Token comparison must be constant-time to prevent timing attacks
- Each release of a capsule must generate new tokens for all contacts (re-releasing after a check-in prevents use of old tokens)

---

### Requirement 29: Contact Passphrase Security

**User Story:** As a user assigning a trusted contact, I want to provide a passphrase for the contact that is securely stored, so that the contact can decrypt the capsule upon release.

#### Acceptance Criteria

1. WHEN a user assigns a trusted contact to a capsule, THE System SHALL accept a contact-specific passphrase (may differ from the user's capsule passphrase)
2. WHEN the contact-specific passphrase is stored, THE System SHALL hash it using bcrypt (or similar) with salt; plaintext passphrases must never be stored
3. WHEN a trusted contact receives a Release Link, the notification SHALL include instructions to use the contact-specific passphrase (provided by the user separately, not in the email)
4. WHEN a contact enters the passphrase via the Release Link, THE System SHALL verify the passphrase against the stored hash
5. WHERE a contact provides an incorrect passphrase, THE System SHALL deny access and log the failed attempt; after 10 failed attempts, the Release Link SHALL be temporarily locked for 15 minutes

#### Security Considerations
- Contact passphrases should be communicated to contacts out-of-band (not via email, or via separate secure channel)
- Contact passphrases are distinct from both the user's account password and the capsule encryption passphrase
- Contact passphrases should be hashed with bcrypt, 12+ salt rounds
- Failed access attempts must be rate-limited to prevent brute-force attacks

---

### Requirement 30: Capsule Encryption and Decryption Workflow

**User Story:** As the system, I want to provide a complete, secure workflow for encrypting capsules on creation and decrypting them on access, so that users and contacts can safely exchange sensitive information.

#### Acceptance Criteria

1. **On Capsule Creation:**
   - User enters capsule title, description, text content, and optional file attachments
   - User enters or confirms the capsule encryption passphrase
   - Browser derives a 256-bit key from passphrase using PBKDF2 (100k iterations, SHA-256) with random salt
   - Browser encrypts capsule content (title, description, text, file metadata) using AES-GCM-256 with random nonce
   - Browser sends only: capsule ID, ciphertext, salt, nonce, file attachments (if present), and associated metadata to server
   - Server stores ciphertext and metadata; plaintext and passphrase are never sent or stored

2. **On Capsule Editing (Before Release):**
   - User accesses capsule via authenticated session
   - Browser retrieves ciphertext from server
   - User enters the passphrase; browser derives key using PBKDF2 with stored salt
   - Browser decrypts ciphertext in browser only; plaintext is displayed for editing
   - User modifies content and re-encrypts using same workflow as creation
   - Browser sends new ciphertext to server

3. **On Capsule Release to Contact:**
   - Release Link is generated with unique token for each contact
   - Contact accesses Release Link; browser does not prompt for passphrase yet
   - Contact enters contact-specific passphrase; browser derives key using PBKDF2 with stored salt
   - Browser retrieves ciphertext from server and decrypts using derived key
   - Plaintext is displayed in browser; contact can read the message
   - Release Link is marked as used; subsequent accesses to same link must re-enter passphrase

4. **Round-Trip Property:**
   - FOR ALL capsule content, the round-trip property SHALL hold: encrypt(plaintext, passphrase, salt) → store → retrieve → decrypt(ciphertext, passphrase, salt) ≈ plaintext
   - Decryption failures or authentication errors must be logged without revealing why

#### Security Considerations
- All encryption/decryption must occur client-side (browser)
- Passphrases must never be transmitted; only derived keys are used for encryption
- Nonces must be random and unique for each encryption
- Round-trip testing is essential for parser/serializer verification
- Stored files within capsules must maintain their binary integrity through encrypt/decrypt cycle

---

## Glossary Additions

Additional terms:

- **Encryption Key**: A 256-bit symmetric key derived from a passphrase using PBKDF2; used for AES-GCM encryption/decryption
- **Nonce**: A 96-bit random number used once per encryption operation to ensure uniqueness of ciphertext
- **Salt**: A random byte string mixed with the passphrase during PBKDF2 key derivation to prevent rainbow table attacks
- **Ciphertext**: The encrypted form of plaintext; unreadable without the correct key
- **Authentication Tag**: A cryptographic tag computed during AES-GCM encryption and verified during decryption to ensure data integrity and authenticity
- **Session Token**: A temporary, unique identifier issued after user authentication, used to maintain an authenticated session
- **bcrypt**: A password hashing algorithm using the Blowfish cipher; designed to be slow and resistant to brute-force attacks
- **PBKDF2**: Password-Based Key Derivation Function 2; derives cryptographic keys from passwords by iteratively applying a pseudorandom function (HMAC)
- **SHA-256**: Secure Hash Algorithm 2 with 256-bit output; produces a fixed-size hash from arbitrary-size input
- **WebCrypto API**: Browser's native cryptographic interface for key generation, encryption, decryption, hashing, and signing
- **XSS (Cross-Site Scripting)**: A security vulnerability where attacker injects malicious JavaScript into a web page
- **CSP (Content Security Policy)**: HTTP header that restricts script sources and prevents inline scripts to mitigate XSS attacks
- **HSTS (HTTP Strict-Transport-Security)**: HTTP header that instructs browsers to use HTTPS only for future connections
- **TLS/SSL**: Transport Layer Security / Secure Sockets Layer; cryptographic protocols for secure communication over the internet
- **SMTP**: Simple Mail Transfer Protocol; protocol for sending emails

