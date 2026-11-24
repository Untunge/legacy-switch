# Legacy Switch — Implementation Ready

## ✅ Spec-Driven Planning Complete

All formal planning documents for the Legacy Switch MVP have been created and validated using spec-driven development methodology. The project is **ready to begin Phase 1 implementation**.

## 📂 What's Been Created

### Steering Documents
Located in `.kiro/steering/`:
- **product.md** — Product vision, MVP scope, success criteria
- **tech.md** — Technology stack decisions with rationale
- **structure.md** — Repository layout and security boundaries

### Specification Documents
Located in `.kiro/specs/legacy-switch/`:
- **requirements.md** (48 KB, 3,790 lines)
  - 30 formal requirements with EARS patterns
  - User stories and acceptance criteria for each
  - 40+ term glossary
  - Complete coverage of MVP features
  
- **design.md** (87 KB, 1,500+ lines)
  - System architecture (frontend/backend/database)
  - Complete database schema with 8 tables
  - Timer state machine with transitions
  - REST API design (25+ endpoints)
  - Encryption architecture (PBKDF2 + AES-GCM-256)
  - 6 formal correctness properties
  - Security model and threat analysis
  - Demo mode specification
  
- **tasks.md** (26 KB, 72 implementation tasks)
  - 72 discrete, 2-4 hour tasks
  - Organized in 5 phases with clear dependencies
  - Traceability to requirements
  - Acceptance criteria for each task
  - 216 hours total effort (5-6 weeks for 1 developer)

## 🎯 MVP Scope

**10 Core Features:**
1. User Accounts (email + bcrypt + JWT)
2. Capsules (encrypted containers for legacy info)
3. End-to-End Encryption (PBKDF2 + AES-GCM-256, browser-side)
4. Check-in & Timer (daily/weekly/monthly intervals)
5. Grace Period (7 days before automatic release)
6. Trusted Contacts (one-time-use release links)
7. Email Notifications (staged warnings)
8. Dashboard (timer status, capsule list, candle metaphor)
9. Audit Trail (immutable, tamper-evident logging)
10. Demo Mode (1000x acceleration for judges)

## 🛠️ Tech Stack

**Frontend**: React 18 + Vite + TypeScript + Tailwind + TanStack Router + WebCrypto
**Backend**: Node.js 20+ + Hono + TypeScript + Drizzle ORM
**Database**: SQLite (dev) → PostgreSQL (prod)
**Deployment**: Vercel (frontend) + Fly.io/Render (backend)
**Email**: Resend API (free tier) with console fallback in demo

## 📊 Task Breakdown

| Phase | Focus | Tasks | Hours |
|-------|-------|-------|-------|
| 1 | Infrastructure & DB | 8 | 24h |
| 2 | Backend auth & services | 17 | 48h |
| 3 | Frontend pages & components | 15 | 42h |
| 4 | Encryption, email, demo, contacts | 20 | 60h |
| 5 | Security hardening & testing | 12 | 42h |
| **TOTAL** | **Full MVP** | **72** | **216h** |

## 🚀 Getting Started

### Phase 1 — Infrastructure (Ready now)
1. Clone repo and set up monorepo (Vite + React, Hono + Node)
2. Configure database (Drizzle + SQLite)
3. Set up environment variables
4. Verify TypeScript compilation and dev environment

**Expected Duration**: 1 day

### Phase 2 — Backend Core (Depends on Phase 1)
5. User authentication (signup, login, JWT)
6. Capsule CRUD endpoints
7. Timer service and background jobs
8. Email queuing service
9. Release management

**Expected Duration**: 3-4 days

### Phase 3 — Frontend Core (Depends on Phase 2)
10. React Router setup with protected routes
11. Login and dashboard pages
12. Capsule form and detail pages
13. UI components and hooks
14. Styling and candle metaphor visualization

**Expected Duration**: 3-4 days

### Phases 4-5 — Encryption, Testing, Security (Parallel with Phase 3)
15. WebCrypto wrapper (PBKDF2 + AES-GCM-256)
16. Email templates and Resend integration
17. Demo mode (1000x timer acceleration)
18. Security hardening (rate limiting, CORS, CSP)
19. Unit, integration, and E2E testing
20. Property-based tests for correctness properties
21. Production deployment configuration

**Expected Duration**: 5-7 days

## 🔐 Security Properties

The design includes 6 formal correctness properties:

1. **Encryption Round-Trip**: `decrypt(encrypt(x)) == x`
2. **Timer State Machine**: Valid transitions (ACTIVE → GRACE_PERIOD → RELEASED)
3. **Single-Use Tokens**: Release link tokens used exactly once
4. **Audit Log Integrity**: Tamper-evident hash chain
5. **Check-in Extension**: Timer extends by exact interval duration
6. **Content Hash Validation**: Server-side verification without decryption

Each property has property-based tests using fast-check.

## 📚 How to Use These Specs

1. **For Development**:
   - Read tasks.md to see the implementation plan
   - Each task has acceptance criteria, file responsibilities, and dependencies
   - Tasks link to requirements and design sections for context

2. **For Architecture Decisions**:
   - Read design.md for system architecture, API design, and data model
   - Read tech.md for stack decisions with rationale

3. **For Verification**:
   - Each task references the requirements it implements
   - Run property-based tests to verify correctness properties
   - Follow the test approach specified in each task

4. **For Onboarding**:
   - New developers should read SPEC-OVERVIEW.md first
   - Then read requirements.md for feature context
   - Then read design.md for technical context
   - Then read the specific tasks they'll work on

## 🎯 Quality Checklist

Before launching Phase 1:
- [ ] All spec documents are readable and clear
- [ ] Stack decisions are locked (see tech.md)
- [ ] Security model is understood (see design.md)
- [ ] Database schema is finalized (see design.md)
- [ ] API design is approved (see design.md)
- [ ] Task dependencies are mapped (see tasks.md)
- [ ] Team capacity is estimated (216 hours = ~1 month for 1 dev)

## 📞 Questions?

- **Product Questions**: See product.md
- **Technical Stack**: See tech.md
- **Architecture**: See design.md
- **Requirements**: See requirements.md
- **Implementation Plan**: See tasks.md
- **Quick Reference**: See SPEC-OVERVIEW.md

---

**Status**: ✅ Planning phase complete. Ready for Phase 1 implementation.

**Next Step**: Begin with Task 1 in Phase 1 (Project directory structure and build configuration).

**Estimated Delivery**: 5-6 weeks (1 developer, full-time)
