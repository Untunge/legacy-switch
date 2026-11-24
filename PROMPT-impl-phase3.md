Continue implementing Legacy Switch from the spec in .kiro/specs/legacy-switch/ (requirements.md, design.md, tasks.md) and the steering docs in .kiro/steering/. Phases 1-2 are done (25/72 tasks): the backend is complete and smoke-tested end to end — health, signup, login, capsule CRUD, check-in, session, and audit endpoints all verified working against a live server on http://localhost:3001 with cookie-based JWT auth.

Implement ONLY Phase 3 (tasks 26-37 in tasks.md), following design.md:
- React Router setup and app layout (routes: /login, /dashboard, /capsule/new, /capsule/:id, /releases/:id, /audit/:id; protected routes redirect to /login)
- Auth context + login page + registration page (call POST /auth/login, POST /auth/signup; session restored via GET /auth/session)
- Dashboard page: capsule list sorted by urgency, timer state badges, time remaining, Check In button, View/Edit/Delete actions
- Capsule form page (create + edit modes; collects title, description, plaintext content, files, interval, trusted contacts; passphrase validated 8+ chars client-side and never sent to the server — encryption itself is Phase 4, so for now store the plaintext in the encryptedContent field with a clear TODO comment marking it as placeholder until Phase 4 wires in WebCrypto)
- Capsule detail page (metadata, timer state, last 5 check-ins, contact list with status)
- Release preview page (token from URL, passphrase prompt, placeholder decryption note for Phase 4)
- Audit log page with hash-chain verification button
- API hooks (useCapsules, useCheckIn, useContacts) with TanStack React Query
- Theme context + Tailwind styling (dark horror theme, candle metaphor animations, responsive)
- Error boundary component and checkpoint task 37

Verify your work: type-check and lint must be green, and the frontend production build (npm run build -w frontend) must pass. If you start a dev server to check it serves, use a timeout-bounded command that exits on its own — do not leave long-running servers inside tool calls. Update the task checkboxes in tasks.md for tasks 26-37, then VERIFY with grep that they actually show [x] before finishing.

Do NOT implement later phases yet, and do NOT commit anything to git.
