Continue Phase 2 of Legacy Switch (tasks 9-25 in .kiro/specs/legacy-switch/tasks.md). The previous run was cut off by a 25-minute timeout while fixing lint issues, so first inspect what already exists before writing anything: list backend/src/routes, backend/src/services, and backend/src/db/migrations, and read backend/src/index.ts.

Current state (verified): type-check is green, and lint is now green after running prettier --write. Routes exist for auth, capsules, checkin, contacts, releases; services exist for auth, capsule, timer, release, contact, email, audit; the initial migration exists.

Your job now:
1. Complete any Phase 2 gaps: make sure the background jobs exist and are wired into the server (timer expiration check every 60s, grace period expiration and release), the GET /auth/session endpoint, and the GET /capsules/{id}/audit endpoint. Follow design.md.
2. Do NOT add eslint-disable comments or chase lint warnings file by file — lint is already green. Fix real problems at their root cause only.
3. Smoke-test the API end to end: start the backend server, then curl signup, login, capsule create, check-in, and at least one release-link flow. Fix any errors until the whole flow works.
4. Run type-check and lint and confirm both are green.
5. Update the task checkboxes in tasks.md for tasks 9-25, then VERIFY with grep that they actually show [x] before finishing. Do not report success until grep confirms it.

Work efficiently — this run has a limited time budget, so prioritize working endpoints and verification over polish. Do NOT implement later phases yet, and do NOT commit anything to git.
