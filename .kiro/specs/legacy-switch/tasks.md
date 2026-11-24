# Implementation Plan: Legacy Switch MVP

## Overview

Legacy Switch is a full-stack web application for secure personal legacy management. This implementation plan breaks down the design into 72 discrete, deliverable tasks organized across 5 phases. Each task is estimated at 2-4 hours and includes specific acceptance criteria, file responsibilities, and dependency information.

**Total Tasks**: 72  
**Estimated Effort**: 72 tasks × 3 hours avg = 216 hours ≈ 1 developer × 5-6 weeks (or 2 developers × 3 weeks)

---

## Phase Breakdown

| Phase | Tasks | Focus | Duration |
|-------|-------|-------|----------|
| **Phase 1** | 1-8 | Database, schema, migrations, build config | 24 hours |
| **Phase 2** | 9-25 | Backend auth, capsule CRUD, timer services | 48 hours |
| **Phase 3** | 26-40 | Frontend pages, components, routing, state | 42 hours |
| **Phase 4** | 41-60 | Encryption, email, demo mode, contacts UI | 60 hours |
| **Phase 5** | 61-72 | Security (rate limiting, audit), testing | 42 hours |

**Total**: 72 tasks, 216 hours

---

## Tasks

### Phase 1: Infrastructure & Database Setup

- [x] 1. Set up project directory structure and build configuration
  - Requirement Coverage: General infrastructure
  - Dependencies: None
  - Create monorepo with frontend (Vite + React 18 + TypeScript + Tailwind) and backend (Node.js + Hono + TypeScript)
  - Root package.json with workspace scripts for simultaneous dev/build
  - Both frontend and backend pass linting

- [x] 2. Set up SQLite database for local development and PostgreSQL schema
  - Requirement Coverage: General infrastructure, Req 27
  - Dependencies: Blocked by Task 1
  - Configure Drizzle ORM with SQLite (dev) and PostgreSQL (prod)
  - Set up database connection pooling and migration system

- [x] 3. Define and generate Drizzle ORM database schema
  - Requirement Coverage: Req 27
  - Dependencies: Blocked by Task 2
  - Create all 8 table schemas with relationships, indexes, and constraints
  - Generate TypeScript types from schema; verify compilation

- [x] 4. Create database migration for initial schema
  - Requirement Coverage: Req 27
  - Dependencies: Blocked by Task 3
  - Generate migration SQL for all 8 tables
  - Test migration on both SQLite and PostgreSQL

- [x] 5. Set up environment variables and secrets management
  - Requirement Coverage: General infrastructure, Req 25, Req 23
  - Dependencies: Blocked by Task 2
  - Create .env.local.example with all required env vars
  - Configure dotenv loading; ensure secrets not logged

- [x] 6. Set up API error handling and middleware stack
  - Requirement Coverage: Req 26, Req 24
  - Dependencies: Blocked by Task 1
  - Create centralized error handling middleware with standard error response format
  - Implement CORS, request logging, error ID generation

- [x] 7. Set up TypeScript types and shared interfaces
  - Requirement Coverage: General infrastructure
  - Dependencies: Blocked by Task 3
  - Define all TypeScript interfaces and Zod validation schemas
  - Export types from /backend/src/types/index.ts

- [x] 8. Checkpoint - Verify all infrastructure is correctly set up
  - Requirement Coverage: General infrastructure
  - Dependencies: Blocked by Tasks 1-7
  - Verify TypeScript compilation, database connection, middleware loading
  - ESLint passes with zero errors/warnings; dev environment starts correctly

### Phase 2: Backend Core - Authentication & Services

- [x] 9. Implement user registration (signup) endpoint
  - Requirement Coverage: Req 1
  - Dependencies: Blocked by Task 8
  - POST /auth/signup validates email/password, hashes with bcrypt (12+ rounds)
  - Create user account, return JWT token (24-hour expiry), log signup in Audit Log

- [x] 10. Implement user login endpoint
  - Requirement Coverage: Req 1
  - Dependencies: Blocked by Task 9
  - POST /auth/login authenticates by email/password with constant-time comparison
  - Rate limiting: max 5 attempts/min per IP; generic error message for invalid credentials

- [x] 11. Implement JWT token generation and validation
  - Requirement Coverage: Req 1, Req 22
  - Dependencies: Blocked by Task 9
  - JWT generated with payload {userId, email} and 24-hour expiry
  - Token stored in httpOnly cookie; validation middleware checks signature and expiry
  - Session timeout: 30min inactivity, 24-hour max; logout clears cookie

- [x] 12. Implement password reset workflow
  - Requirement Coverage: Req 1
  - Dependencies: Blocked by Task 9
  - Request endpoint generates 1-hour token; confirmation endpoint validates and updates password
  - Token hashed before storage; invalidated after use
  - Generic response to prevent email enumeration

- [x] 13. Create Capsule model and CRUD service
  - Requirement Coverage: Req 2, Req 30
  - Dependencies: Blocked by Task 8
  - CapsuleService with create, read, update, delete methods
  - Store encrypted content, salt, nonce, contentHash; verify ownership
  - Reject updates after release

- [x] 14. Implement Timer service with state machine
  - Requirement Coverage: Req 5, Req 6, Req 7
  - Dependencies: Blocked by Task 13
  - Timer states: ACTIVE → GRACE_PERIOD → RELEASED (irreversible)
  - Check-in updates lastCheckin, resets nextRelease
  - Interval configuration: DAILY, WEEKLY, MONTHLY

- [x] 15. Implement background job for timer expiration checking
  - Requirement Coverage: Req 5, Req 7, Req 10
  - Dependencies: Blocked by Task 14
  - Background job runs every 60s; scans for ACTIVE timers past nextRelease
  - Transitions to GRACE_PERIOD, sets graceEndsAt=NOW+7days
  - Sends 7-day and 3-day warning emails

- [x] 16. Implement grace period expiration and capsule release
  - Requirement Coverage: Req 7, Req 9
  - Dependencies: Blocked by Task 15
  - Background job for GRACE_PERIOD timers past graceEndsAt
  - Generates 32-byte token per contact, hashes and stores tokenHash
  - Sends release notification emails to all contacts

- [x] 17. Implement Release Link validation and capsule preview
  - Requirement Coverage: Req 9, Req 28
  - Dependencies: Blocked by Task 16
  - GET /releases/{capsuleId}?token={token} validates token via constant-time comparison
  - Returns capsule metadata (title, description, encryptedContent, salt, nonce)
  - Rate limit: 10 token verification attempts per IP per second

- [x] 18. Implement Release Link confirm endpoint (mark token as used)
  - Requirement Coverage: Req 9, Req 28
  - Dependencies: Blocked by Task 17
  - POST /releases/{capsuleId}/confirm marks tokenHash as used
  - Updates contacts.accessed=TRUE, accessedAt=NOW
  - Logs access event in Audit Log

- [x] 19. Implement Contact management service
  - Requirement Coverage: Req 8, Req 29
  - Dependencies: Blocked by Task 13
  - ContactService for add, remove, list contacts per capsule
  - Store email, name, bcrypt hash of passphrase (12+ rounds)
  - Prevent duplicate contacts

- [x] 20. Implement email queuing service
  - Requirement Coverage: Req 10, Req 23
  - Dependencies: Blocked by Task 8
  - EmailService with queue-based sending, retry logic (exponential backoff)
  - Background job every 5 minutes; sends via Resend API or logs in demo mode
  - Failed sends retry: 1min, 5min, 15min; max 3 retries

- [x] 21. Implement Audit service with tamper-evident hash chain
  - Requirement Coverage: Req 13, Req 14, Req 15
  - Dependencies: Blocked by Task 8
  - AuditService for append-only audit logging with SHA-256 hash chain
  - Each entry: hash = SHA256(prevHash || entryData || seqNum)
  - Prevent modifications/deletes; getAuditTrail returns entries with hashes

- [x] 22. Implement rate limiting middleware for sensitive endpoints
  - Requirement Coverage: Req 1, Req 29
  - Dependencies: Blocked by Task 6
  - Token bucket rate limiting per IP: login 5/min, email 10/min, API 100/min, token verify 10/sec
  - Excess requests return 429 with retry-after header

- [x] 23. Implement GET /auth/session endpoint for session restoration
  - Requirement Coverage: Req 22
  - Dependencies: Blocked by Task 11
  - Returns {userId, email, createdAt} if JWT valid
  - Used by frontend on page load to restore session

- [x] 24. Implement GET /capsules/{id}/audit endpoint for audit trail retrieval
  - Requirement Coverage: Req 13, Req 14
  - Dependencies: Blocked by Task 21
  - Returns audit entries for capsule sorted by timestamp DESC
  - Verify ownership; include hash and prevHash fields for chain verification

- [x] 25. Checkpoint - Backend services complete and testable
  - Requirement Coverage: Req 1-15, 23, 27, 28, 29
  - Dependencies: Blocked by Tasks 9-24
  - Verify auth flow works end-to-end, capsule CRUD functional
  - Timer state machine correct, email queuing works, audit logging operational

### Phase 3: Frontend Core - Pages & Components

- [x] 26. Set up React Router and app layout
  - Requirement Coverage: General frontend infrastructure
  - Dependencies: Blocked by Task 1
  - Configure TanStack React Router with routes: /login, /dashboard, /capsule/new, /capsule/:id, /releases/:id, /audit/:id
  - Protected routes redirect unauthenticated users to /login
  - Navigation bar with user email and logout button

- [x] 27. Create authentication context and login page
  - Requirement Coverage: Req 1, Req 22
  - Dependencies: Blocked by Tasks 26 and Task 9
  - AuthContext with useAuth hook for user state management
  - LoginPage with email/password form; calls POST /auth/login
  - On success, JWT stored; user redirected to dashboard

- [x] 28. Create user registration page
  - Requirement Coverage: Req 1
  - Dependencies: Blocked by Task 27
  - RegisterPage with email, password, password confirm fields
  - Client-side validation; calls POST /auth/signup
  - On success, user logged in and redirected to dashboard

- [x] 29. Create Dashboard page with capsule list and timer display
  - Requirement Coverage: Req 11, Req 12, Req 16
  - Dependencies: Blocked by Tasks 27 and Task 25
  - Dashboard queries GET /capsules; displays all user's capsules sorted by urgency
  - Each capsule shows: title, interval, time remaining, timer state badge
  - "Check In" button; action buttons: View, Edit, Delete

- [x] 30. Create Capsule form page for creating/editing capsules
  - Requirement Coverage: Req 2, Req 6, Req 8
  - Dependencies: Blocked by Task 29
  - Form supports create (blank) and edit (pre-filled) modes
  - Collects: title, description, plaintext content, files, interval, trusted contacts
  - Passphrase validated (8+ chars) but never sent to server
  - File upload: max 10MB per file, 100MB total

- [x] 31. Create Capsule detail page
  - Requirement Coverage: Req 16, Req 8
  - Dependencies: Blocked by Tasks 25 and Task 29
  - Displays capsule metadata, timer state, check-in history (last 5)
  - Contact list with status (pending/released/accessed)
  - "Add Contact", "Remove Contact" buttons; "View Full History" link

- [x] 32. Create Release Preview page (contact access)
  - Requirement Coverage: Req 9, Req 20
  - Dependencies: Blocked by Tasks 25 and Task 17
  - Accessed via Release Link with token in URL
  - Displays capsule title and "Enter your passphrase" prompt
  - Submits token hash and passphrase; retrieves ciphertext and decrypts client-side

- [x] 33. Create Audit Log page for viewing and verifying hash chain
  - Requirement Coverage: Req 13, Req 14
  - Dependencies: Blocked by Tasks 24 and Task 29
  - Displays capsule access history with tamper-evident hash chain verification
  - "Verify Hash Chain" button runs client-side verification
  - Verification result shown: "✓ Hash chain valid" or "✗ Tampering detected"

- [x] 34. Create React hooks for API calls (useCapsules, useCheckIn, useContacts)
  - Requirement Coverage: Req 2, Req 5, Req 8
  - Dependencies: Blocked by Tasks 25 and Task 27
  - useCapsules: { capsules, loading, createCapsule, updateCapsule, deleteCapsule }
  - useCheckIn: { loading, checkIn } — calls POST /capsules/{id}/checkin
  - useContacts: { contacts, addContact, removeContact }
  - Use TanStack React Query for caching/refetching

- [x] 35. Create theme context and Tailwind styling setup
  - Requirement Coverage: General frontend
  - Dependencies: Blocked by Task 1
  - Tailwind configured with custom theme colors
  - Candle metaphor animations defined (flame flickering, color transitions)
  - Dark mode support; responsive design for mobile/tablet/desktop

- [x] 36. Create error boundary component and error handling UI
  - Requirement Coverage: Req 26
  - Dependencies: Blocked by Task 26
  - ErrorBoundary catches React errors; displays user-friendly message with error ID
  - "Try again" button; error logged server-side

- [x] 37. Checkpoint - Frontend pages and components complete
  - Requirement Coverage: Req 1, 2, 5, 6, 8, 11, 12, 13, 14, 16, 22
  - Dependencies: Blocked by Tasks 26-36
  - Verify routing works, login/register functional, dashboard displays capsules
  - Capsule form works, check-in button works, release preview functional

### Phase 4: Encryption, Email, Demo Mode & Contacts

- [x] 38. Implement WebCrypto wrapper utilities (PBKDF2, AES-GCM)
  - Requirement Coverage: Req 3, Req 4, Req 19, Req 30
  - Dependencies: Blocked by Task 1
  - deriveKey(passphrase, salt) returns CryptoKey for PBKDF2 (100k iterations, SHA-256)
  - encrypt(plaintext, passphrase, salt) returns { ciphertext, nonce, salt } (hex-encoded)
  - decrypt(ciphertext, passphrase, salt, nonce) returns plaintext; throws on auth tag failure
  - Round-trip property verified

- [-] 39. Integrate encryption into capsule creation/editing
  - Requirement Coverage: Req 2, Req 3, Req 4, Req 30
  - Dependencies: Blocked by Tasks 38 and Task 30
  - On form submit: encrypt plaintext in browser with PBKDF2+AES-GCM
  - Backend receives: ciphertext, salt, nonce, contentHash only
  - On edit: decrypt ciphertext in browser for display

- [-] 40. Integrate encryption into release link decryption
  - Requirement Coverage: Req 9, Req 30
  - Dependencies: Blocked by Tasks 38 and Task 32
  - Contact submits passphrase; frontend derives key using stored salt
  - Frontend retrieves ciphertext and decrypts in browser
  - Decryption success: plaintext displayed; contact marks link as used

- [x] 41. Implement email template engine and notification types
  - Requirement Coverage: Req 10, Req 23
  - Dependencies: Blocked by Task 20
  - Email templates: WARNING_7_DAYS, WARNING_3_DAYS, RELEASE, ACCESS_CONFIRMATION
  - Each template renders with dynamic data; includes clear call-to-action
  - Demo mode logs email content to console with [DEMO] prefix

- [-] 42. Implement contact-specific passphrase hashing and verification
  - Requirement Coverage: Req 8, Req 29
  - Dependencies: Blocked by Tasks 19 and Task 32
  - Contact passphrase hashed with bcrypt (12+ rounds) on server
  - POST /releases/{capsuleId} accepts and verifies contact passphrase
  - Failed attempts locked for 15min after 10 failures

- [x] 43. Create demo account with pre-populated capsules
  - Requirement Coverage: Req 18
  - Dependencies: Blocked by Tasks 25 and Task 13
  - On backend startup (DEMO_MODE=true): create "judge@demo.local" / "demo"
  - Pre-populate 3 capsules: ACTIVE (50%), GRACE_PERIOD (1min), RELEASED (accessed)

- [-] 44. Implement timer acceleration for demo mode (1000x)
  - Requirement Coverage: Req 18
  - Dependencies: Blocked by Task 43
  - DEMO_TIMER_MULTIPLIER=1000 controls acceleration
  - Timer calculations: nextRelease = now + (interval_seconds / multiplier)
  - Demo timers auto-transition; console logging shows each state transition

- [x] 45. Implement demo mode console logging instead of email sending
  - Requirement Coverage: Req 18
  - Dependencies: Blocked by Task 44
  - Log to console: "[DEMO] Email Send Event" with recipient, type, subject, body preview
  - Demo mode prevents any real SMTP calls

- [ ] 46. Implement Contact form in Capsule form UI
  - Requirement Coverage: Req 8
  - Dependencies: Blocked by Task 30
  - Add Contact form with fields: email, name (optional), passphrase
  - Email validated; passphrase validated 8+ chars
  - Contact list displays all assigned contacts with remove options

- [~] 47. Implement contact removal and access confirmation emails
  - Requirement Coverage: Req 8, Req 10
  - Dependencies: Blocked by Tasks 19 and Task 46
  - removeContact backend: delete contact and invalidate any existing tokens
  - Access confirmation email sent to original user when contact opens capsule

- [~] 48. Implement timer urgency display and candle metaphor animation
  - Requirement Coverage: Req 11, Req 12
  - Dependencies: Blocked by Tasks 29 and Task 35
  - Timer component with candle metaphor visual
  - Flame height proportional to time remaining (100% → 0%)
  - Color transitions: gold (ACTIVE) → orange (GRACE_PERIOD) → extinguished (RELEASED)

- [~] 49. Implement check-in history with privacy-preserving timestamps
  - Requirement Coverage: Req 17, Req 16
  - Dependencies: Blocked by Tasks 24 and Task 29
  - Display last 5 check-ins with rounded timestamps (1-hour precision)
  - "View Full History" link shows all check-ins (paginated)

- [~] 50. Checkpoint - Encryption, email, demo, contacts fully integrated
  - Requirement Coverage: Req 2-10, 18
  - Dependencies: Blocked by Tasks 38-49
  - Verify capsules encrypt/decrypt correctly, email sends, demo mode works
  - Contacts assigned and accessed; access confirmation email sent

### Phase 5: Security, Audit, Testing & Polish

- [~] 51. Implement input validation and sanitization middleware
  - Requirement Coverage: Req 24
  - Dependencies: Blocked by Task 6
  - Email validated against RFC 5322; password requires 8+ chars; passphrase requires 8+ chars
  - File uploads: max 10MB per file, 100MB total
  - Text content sanitized to prevent XSS

- [~] 52. Implement CORS and security headers
  - Requirement Coverage: Req 25
  - Dependencies: Blocked by Task 6
  - CORS allows only frontend origin
  - Security headers: HSTS (max-age=31536000), CSP, X-Frame-Options, X-Content-Type-Options

- [~] 53. Implement HTTPS redirect and TLS enforcement
  - Requirement Coverage: Req 25
  - Dependencies: Blocked by Task 6
  - HTTP requests redirected to HTTPS; HTTPS enforced in production
  - TLS 1.2 or higher configured

- [~] 54. Add logging and monitoring infrastructure
  - Requirement Coverage: Req 26
  - Dependencies: Blocked by Tasks 6 and Task 21
  - All errors logged with timestamp, type, stack trace, user ID, affected resource
  - Error IDs generated and shown to user; logged server-side for correlation
  - Sensitive data never logged

- [~] 55. Implement Content Security Policy (CSP) for XSS prevention
  - Requirement Coverage: Req 19, Req 25
  - Dependencies: Blocked by Task 52
  - CSP header: default-src 'self'; script-src 'self'; no inline scripts
  - Frontend build produces no inline scripts; CSP allows WebCrypto and fetch

- [~] 56. Write unit tests for encryption (PBKDF2, AES-GCM round-trip)
  - Requirement Coverage: Req 3, Req 4, Req 30
  - Dependencies: Blocked by Task 38
  - Test: deriveKey returns same key for same input (determinism)
  - Test: encrypt(plaintext, pw, salt) → decrypt(pw, salt) = plaintext
  - Test: different passphrases produce different keys; tampered ciphertext fails

- [~] 57. Write property-based tests for encryption round-trip
  - Requirement Coverage: Req 3, Req 4
  - Dependencies: Blocked by Task 38
  - Property: FOR ALL plaintext, passphrase ∈ String, encrypt(p, pw, s) → decrypt(pw, s) = p
  - Use fast-check; generate 100+ examples; all pass

- [~] 58. Write tests for timer state machine
  - Requirement Coverage: Req 5, Req 6, Req 7
  - Dependencies: Blocked by Task 14
  - Test state transitions: ACTIVE → GRACE_PERIOD → RELEASED
  - Test check-in resets timer; grace period expiration irreversible

- [~] 59. Write tests for audit log hash chain
  - Requirement Coverage: Req 13, Req 14, Req 15
  - Dependencies: Blocked by Task 21
  - Test hash chain links correctly, tampering detected
  - Test: modify entry → hash chain invalid; insert entry → sequence breaks

- [~] 60. Write integration tests for complete auth and capsule flow
  - Requirement Coverage: Req 1-15, 23, 27, 30
  - Dependencies: Blocked by Tasks 25 and Task 50
  - Test: register, login, create capsule, check-in, timer expiration, release, contact access

- [~] 61. Write tests for release link token validation
  - Requirement Coverage: Req 9, Req 28
  - Dependencies: Blocked by Tasks 17 and Task 18
  - Test token generation, hashing, one-time-use, constant-time comparison

- [~] 62. Performance optimization and stress testing
  - Requirement Coverage: General performance
  - Dependencies: Blocked by Tasks 25 and Task 60
  - Optimize database queries, implement caching
  - Stress testing: 1000+ concurrent users; timer checker 10k capsules < 1 min

- [~] 63. Implement rate limiting enforcement and testing
  - Requirement Coverage: Req 1, Req 29
  - Dependencies: Blocked by Task 22
  - Verify rate limits on login, email, token verification
  - Requests exceeding limit return 429 with Retry-After header

- [~] 64. Write documentation for deployment and operations
  - Requirement Coverage: General infrastructure
  - Dependencies: Blocked by Tasks 25 and Task 50
  - Deployment guide, runbook for backups/recovery, troubleshooting guide
  - Operations checklist for pre-production, go-live, post-deployment

- [~] 65. Configure production deployment (Vercel frontend, Fly.io backend)
  - Requirement Coverage: General infrastructure, Req 25
  - Dependencies: Blocked by Tasks 25 and Task 50
  - Frontend builds on Vercel; backend deploys to Fly.io
  - Managed PostgreSQL with automated backups
  - CI/CD pipeline (GitHub Actions)

- [~] 66. Implement graceful error recovery and retry logic
  - Requirement Coverage: Req 26, Req 23
  - Dependencies: Blocked by Tasks 20 and Task 54
  - Email retries: 1min, 5min, 15min backoff; max 3 retries
  - Network failures trigger retry; UI shows helpful next steps

- [~] 67. Final checkpoint - All implementation complete
  - Requirement Coverage: Req 1-30
  - Dependencies: Blocked by Tasks 61-66
  - Verify all 72 tasks complete, integrated, tested
  - Full end-to-end flow tested; all tests passing

- [~] 68. Create user-facing documentation and help pages
  - Requirement Coverage: General polish
  - Dependencies: Blocked by Task 65
  - Quick-start guide, FAQ, security FAQ
  - Help pages linked from app navigation; clear non-technical language

- [~] 69. Implement analytics and monitoring (optional for MVP)
  - Requirement Coverage: General polish
  - Dependencies: Blocked by Tasks 54 and Task 65
  - Track: user signup, capsule creation, timer expiration, release, contact access
  - Dashboard shows: DAU, capsule creation rate, release rate, error rate

- [~] 70. Create accessibility improvements (a11y)
  - Requirement Coverage: General polish
  - Dependencies: Blocked by Task 37
  - Form inputs with ARIA labels; keyboard navigation (Tab, Enter, Escape)
  - Color contrast ratios WCAG AA (4.5:1); focus indicators visible

- [~] 71. Performance profiling and optimization (Phase 2 priority)
  - Requirement Coverage: General polish
  - Dependencies: Blocked by Task 65
  - Frontend bundle < 2MB gzipped
  - PBKDF2 derivation < 500ms; database queries < 100ms

- [~] 72. Final manual testing and quality assurance
  - Requirement Coverage: Req 1-30
  - Dependencies: Blocked by Tasks 61-71
  - Comprehensive manual testing of all features, edge cases, error scenarios
  - User can complete entire flow without errors
  - Encryption verified; audit log tamper-evident

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "5"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4", "6", "7"] },
    { "id": 4, "tasks": ["8"] },
    { "id": 5, "tasks": ["9", "13"] },
    { "id": 6, "tasks": ["10", "14"] },
    { "id": 7, "tasks": ["11", "12", "15", "16", "19", "20"] },
    { "id": 8, "tasks": ["17", "21"] },
    { "id": 9, "tasks": ["18", "22", "23", "24"] },
    { "id": 10, "tasks": ["25"] },
    { "id": 11, "tasks": ["26", "27", "35"] },
    { "id": 12, "tasks": ["28", "29"] },
    { "id": 13, "tasks": ["30", "31", "32", "34"] },
    { "id": 14, "tasks": ["33"] },
    { "id": 15, "tasks": ["36", "37"] },
    { "id": 16, "tasks": ["38", "41", "43", "45"] },
    { "id": 17, "tasks": ["39", "40", "42", "44", "46", "47", "48", "49", "50"] },
    { "id": 18, "tasks": ["51", "52", "53", "54", "55"] },
    { "id": 19, "tasks": ["56", "57", "58", "59", "60", "61"] },
    { "id": 20, "tasks": ["62", "63", "64", "65"] },
    { "id": 21, "tasks": ["66", "67"] },
    { "id": 22, "tasks": ["68", "69", "70", "71", "72"] }
  ]
}
```

---

## Summary

**Total Tasks**: 72  
**Estimated Effort**: 216 hours (3 hours average per task)  
**Team Capacity**: 1 developer × 5-6 weeks, or 2 developers × 3 weeks  

**Phase Breakdown**:
- **Phase 1** (Tasks 1-8): Infrastructure & Database (24 hours)
- **Phase 2** (Tasks 9-25): Backend Auth & Services (48 hours)
- **Phase 3** (Tasks 26-37): Frontend Pages & Components (42 hours)
- **Phase 4** (Tasks 38-50): Encryption, Email, Demo (36 hours)
- **Phase 5** (Tasks 51-72): Security, Testing, Polish (66 hours)

---

## Notes

- Each task is designed for 2-4 hour completion by a single developer
- Tasks are ordered by dependency; horizontal tasks in each wave can run in parallel
- Checkpoints (Tasks 8, 25, 37, 50, 67) verify phase completion before proceeding
- Testing tasks (56-62) validate correctness properties from design
- Property-based tests (57) verify encryption round-trip holds for all inputs
- All security-critical features (encryption, audit log, timer) have dedicated tests
- Demo mode (Tasks 43-45) enables rapid testing without waiting for real timers
- Production deployment (Task 65) includes Vercel frontend and Fly.io backend
