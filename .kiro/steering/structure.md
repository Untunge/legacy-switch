# Legacy Switch — Repository Structure

## Directory Layout

```
legacy-switch/
├── .kiro/
│   ├── specs/legacy-switch/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   ├── tasks.md
│   │   └── .config.kiro
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md
│   └── hooks/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── styles/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── jobs/
│   │   ├── db/
│   │   └── types/
│   ├── drizzle.config.ts
│   └── package.json
├── shared/
│   ├── types/
│   └── package.json
├── package.json
├── .gitignore
├── .env.local.example
├── CONCEPT.md
└── README.md
```

## File Responsibilities

### Frontend (src/)

**pages/** - Routed components
- LoginPage.tsx - Email/password signup and login
- DashboardPage.tsx - Timer status, capsule list, check-in button
- CapsuleFormPage.tsx - Create/edit encrypted capsule
- ReleasePreviewPage.tsx - View released capsule (authenticated)
- ReceiveReleasePage.tsx - Contact receives one-time link, decrypts capsule

**components/** - Reusable UI
- CapsuleCard.tsx - Capsule summary (title, timer, encrypted indicator)
- Timer.tsx - Visual candle showing urgency
- CheckInButton.tsx - "I'm Alive" button
- ContactList.tsx - Manage trusted contacts
- EncryptedBadge.tsx - E2E encryption indicator
- NotificationBanner.tsx - Grace period / release alerts

**hooks/** - Custom React hooks
- useCheckIn() - Extend timer mutation
- useEncryption() - Encrypt/decrypt with PBKDF2
- useAuth() - Login/logout/session
- useCapsules() - Query user's capsules
- useTimer() - Calculate time remaining
- useDemo() - Demo mode flag

**lib/** - Utilities
- crypto.ts - WebCrypto wrapper (derive key, encrypt, decrypt)
- api.ts - Typed fetch wrappers for all endpoints
- errors.ts - Error definitions
- constants.ts - UI and crypto constants

### Backend (src/)

**routes/** - API endpoints
- auth.ts - POST /auth/signup, /auth/login, /auth/logout
- capsules.ts - CRUD /capsules (store encrypted data)
- checkin.ts - POST /checkin (extend timer)
- contacts.ts - POST/DELETE /capsules/:id/contacts
- releases.ts - POST /releases/:tokenHash, GET /releases/:tokenHash/preview

**services/** - Business logic
- CapsuleService - Create, update, delete, query capsules
- TimerService - Initialize, check-in, calculate status, trigger releases
- EmailService - Send warning and release emails
- AuditService - Log actions immutably

**middleware/** - Request handling
- authMiddleware.ts - Validate JWT
- errorHandler.ts - Standardized error responses
- corsMiddleware.ts - Allow frontend origin
- rateLimiter.ts - Prevent brute-force and spam
- auditLogger.ts - Log with tamper-evident chain

**jobs/** - Background tasks
- timer-checker.ts - Cron job: find expired timers, send warnings and releases

**db/** - Database
- schema.ts - Drizzle ORM schema (users, capsules, timers, contacts, auditLog, oneTimeTokens)
- index.ts - DB client initialization

## Security Boundaries

- **Never Sent to Server**: User passwords, capsule passphrases, decrypted contents
- **Always HTTPS**: Even in demo (self-signed OK locally)
- **Audit Trail**: Tamper-evident (hash chain)
- **One-Time Links**: Hashed, invalidated after first use
- **Rate Limiting**: Prevents brute-force and spam
