Continue implementing Legacy Switch from the spec in .kiro/specs/legacy-switch/ (requirements.md, design.md, tasks.md) and the steering docs in .kiro/steering/. Phases 1-3 are done (37/72 tasks): backend smoke-tested end to end, frontend pages/routing/hooks complete with a verified production build. The capsule form currently stores plaintext in the encryptedContent field with a TODO — Phase 4 replaces that with real encryption.

Implement ONLY Phase 4 (tasks 38-50 in tasks.md), following design.md:
- WebCrypto wrapper utilities: deriveKey via PBKDF2 (100k iterations, SHA-256), encrypt/decrypt via AES-GCM-256 with random 96-bit nonce; round-trip property must hold
- Integrate encryption into capsule creation/editing (encrypt in browser before POST; decrypt in browser on edit) and into release-link decryption (contact passphrase -> key -> decrypt in browser)
- Email template engine (WARNING_7_DAYS, WARNING_3_DAYS, RELEASE, ACCESS_CONFIRMATION) wired into the email service; demo mode logs to console with [DEMO] prefix
- Contact-specific passphrase hashing and verification on the server (bcrypt, lock after 10 failed attempts)
- Demo mode: on backend startup with DEMO_MODE=true, create demo account judge@demo.local / demo with 3 pre-populated capsules (ACTIVE, GRACE_PERIOD, RELEASED); 1000x timer acceleration; console logging instead of real email sends
- Contact form in the capsule form UI, contact removal (invalidates tokens), access confirmation emails
- Timer urgency display with the candle metaphor animation (flame height proportional to time remaining; gold -> orange -> extinguished)
- Check-in history display (last 5, timestamps rounded to the hour)

Also fix two known gaps:
1. GET /capsules/:id/audit returns an empty list because audit events are never recorded — wire audit logging into the auth, capsule, check-in, contact, and release flows so entries actually appear.
2. The dashboard currently sorts capsules by creation date — change it to urgency (time remaining until release) per Requirement 11.

Verify your work: type-check and lint must be green, the frontend production build must pass, and prove the crypto round-trip works (a small node/vitest test that encrypts and decrypts a sample string). If you start a server to check anything, use a timeout-bounded command that exits on its own — do not leave long-running servers inside tool calls. Update the task checkboxes in tasks.md for tasks 38-50, then VERIFY with grep that they actually show [x] before finishing.

Do NOT implement Phase 5 yet, and do NOT commit anything to git.
