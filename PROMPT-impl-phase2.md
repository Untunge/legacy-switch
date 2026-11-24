Continue implementing Legacy Switch from the spec in .kiro/specs/legacy-switch/ (requirements.md, design.md, tasks.md) and the steering docs in .kiro/steering/. Phase 1 (tasks 1-8) is done: monorepo scaffolding, Drizzle schema, types, middleware — type-check and lint are green.

Implement ONLY Phase 2 (tasks 9-25 in tasks.md), in dependency order, following design.md exactly:
- User auth: signup, login, JWT generation/validation (httpOnly cookie, 24h max, 30min inactivity), password reset workflow
- Capsule CRUD service (encrypted content only, ownership checks, reject updates after release)
- Timer service with state machine (ACTIVE -> GRACE_PERIOD -> RELEASED), check-in endpoint, interval config (DAILY/WEEKLY/MONTHLY)
- Background jobs: timer expiration check every 60s, grace period expiration and capsule release (32-byte tokens, hashed storage, release notification emails)
- Release link validation and confirm endpoints, contact management service, email queuing service (retry with backoff; Resend API or console logging in demo mode)
- Audit service with tamper-evident SHA-256 hash chain, rate limiting middleware, GET /auth/session and GET /capsules/{id}/audit endpoints
- Checkpoint task 25: verify the backend end to end

Note: Phase 1 did not produce migration files — generate the initial migration with drizzle-kit and apply it to the dev SQLite database as part of this run.

Verify your work: type-check and lint must be green, and smoke-test the API by starting the server and curling signup, login, capsule create, and check-in; fix any errors until everything passes. Update the task checkboxes in tasks.md for tasks 9-25, then VERIFY with grep that they actually show [x] before finishing (the previous run's checkbox update silently failed — do not report success until grep confirms it).

Do NOT implement later phases yet, and do NOT commit anything to git.
