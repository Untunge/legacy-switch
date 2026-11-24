# Legacy Switch — Spec-Driven Planning Overview

## 📋 What's Been Created

All planning artifacts for the Legacy Switch MVP have been created using spec-driven development methodology:

### Steering Documents (`.kiro/steering/`)
These define product strategy and technical direction:

- **product.md** — Vision, problem, core principles, MVP scope, success metrics
- **tech.md** — Stack decisions (React, Node, Hono, Drizzle, WebCrypto, Resend)
- **structure.md** — Repository layout, file responsibilities, security boundaries

### Spec Documents (`.kiro/specs/legacy-switch/`)
These define the complete specification and implementation plan:

- **requirements.md** — 30 formal requirements with EARS patterns, user stories, acceptance criteria, glossary
- **design.md** — Architecture, database schema, API design, encryption approach, timer state machine, correctness properties
- **tasks.md** — 72 implementation tasks organized in 5 phases, with dependencies and estimates

### Configuration
- **.config.kiro** — Workflow metadata (feature-type: new, workflow: requirements-first)

---

## 🎯 MVP Scope

The spec covers the following MVP features:

1. **User Accounts** — Email signup/login with bcrypt password hashing
2. **Capsules** — Create, edit, delete encrypted containers for personal legacy
3. **End-to-End Encryption** — Browser-side PBKDF2 key derivation + AES-GCM-256 encryption
4. **Check-in & Timer** — User clicks "I'm Alive" to extend timer (daily/weekly/monthly intervals)
5. **Grace Period** — 7-day warning period before automatic release
6. **Trusted Contacts** — Per-capsule contact assignment with one-time-use release links
7. **Email Notifications** — Staged warnings (T-7, T-3 days) with call-to-action
8. **Dashboard** — Timer status, capsule list, check-in history with visual urgency indicator
9. **Audit Trail** — Immutable, tamper-evident logging of all security events
10. **Demo Mode** — Accelerated timers (1000x speed) for judge demo with pre-populated data

---

## 📐 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React 18 + Vite + TypeScript + Tailwind)         │
│ Deployed: Vercel                                             │
│                                                              │
│ Pages: Login, Dashboard, CapsuleForm, ReleasePreview       │
│ Hooks: useAuth, useCapsules, useCheckIn, useEncryption    │
│ Crypto: WebCrypto (PBKDF2 + AES-GCM-256) — Browser only   │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS
                    │
┌───────────────────▼─────────────────────────────────────────┐
│ Backend (Node.js 20+ + Hono + TypeScript)                   │
│ Deployed: Fly.io or Render                                  │
│                                                              │
│ Routes: /auth, /capsules, /checkin, /contacts, /releases   │
│ Services: Auth, Capsule, Timer, Email, Audit               │
│ Jobs: Background timer checker (cron every 5 min)          │
│ Security: JWT, rate limiting, audit logging                │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│ Database (SQLite dev → Postgres prod)                       │
│ ORM: Drizzle                                                │
│                                                              │
│ Tables: users, capsules, timers, contacts,                 │
│         releases, auditLog, oneTimeTokens, emailQueue      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Model

**What stays in the browser (never sent to server):**
- User passwords
- Capsule passphrases
- Decrypted capsule contents

**What stays on server:**
- Encrypted capsule ciphertext (Base64-encoded)
- Password hashes (bcrypt)
- JWT tokens and session data
- Audit log (append-only, tamper-evident)
- One-time token hashes
- Contact passphrase hashes

**Encryption Details:**
- Key derivation: PBKDF2 (100,000 iterations)
- Encryption: AES-GCM 256-bit (WebCrypto API)
- Round-trip property: `decrypt(encrypt(x)) == x` ✓

---

## 📊 Task Breakdown

| Phase | Focus | Tasks | Hours | Developers |
|-------|-------|-------|-------|-----------|
| 1 | Infrastructure, DB, build | 1-8 | 24h | 1 |
| 2 | Backend auth, services | 9-25 | 48h | 1-2 |
| 3 | Frontend pages, components | 26-40 | 42h | 1-2 |
| 4 | Encryption, email, demo, contacts | 41-60 | 60h | 1-2 |
| 5 | Security hardening, testing | 61-72 | 42h | 1-2 |
| **TOTAL** | **Full MVP** | **72** | **216h** | **1 dev = 5-6 wks** |

---

## ✅ What's NOT Included (Phase 2+)

- Biometric unlock
- Video/media in capsules
- Scheduled partial releases
- User-to-user messaging
- Multi-language support
- File attachments (can be added if time permits)

---

## 🚀 Getting Started

### To read the spec:
1. Open `.kiro/specs/legacy-switch/requirements.md` to see formal requirements
2. Open `.kiro/specs/legacy-switch/design.md` to understand architecture
3. Open `.kiro/specs/legacy-switch/tasks.md` to see implementation plan

### To start implementation:
1. Begin with Phase 1 (Infrastructure) — Tasks 1-8
2. Follow the dependency graph in tasks.md
3. Each task has acceptance criteria, file responsibilities, and test approach

### To use Kiro effectively:
- Use `npm run dev` to start frontend + backend simultaneously
- Run tests with `npm run test -- --run` (Vitest)
- Linting: `npm run lint` (ESLint + Prettier)
- DB migration: `npm -w backend run db:push`

---

## 📚 Key References

**Formal Specification:**
- Requirements: 30 requirements covering all MVP features
- Design: 6 correctness properties (encryption, timer, tokens, audit, etc.)
- Tasks: 72 implementation tasks with traceability to requirements

**Encryption & Security:**
- PBKDF2: 100k iterations (browser-side key derivation)
- AES-GCM-256: WebCrypto API (symmetric encryption)
- Bcrypt: 12+ rounds (password hashing)
- JWT: 24-hour expiry, refresh token pattern

**Timer & State Machine:**
- States: ACTIVE → GRACE_PERIOD → RELEASED
- Check-in extends timer by interval duration
- Grace period: 7 days after expiry
- Background job runs every 5 minutes

**Demo Mode:**
- Flag: `DEMO_MODE=true` (backend), `VITE_DEMO_MODE=true` (frontend)
- Timer multiplier: 1000x (1 day = 1 minute)
- Demo account: `judge@demo.local` / password: `demo`
- Pre-populated with 3 capsules in different states

---

## 🤝 Contributing

When implementing tasks:
1. Read the task acceptance criteria in tasks.md
2. Check the "Files Modified/Created" section
3. Follow the TypeScript conventions in tech.md
4. Write tests as specified in the task
5. Link commits to task IDs (e.g., "Task 15: Implement...")
6. Update the task checkbox when complete

---

**Status**: ✅ Planning phase complete. Ready for Phase 1 implementation.

**Questions?** Refer to the steering docs (product, tech, structure) for strategy and high-level decisions.
