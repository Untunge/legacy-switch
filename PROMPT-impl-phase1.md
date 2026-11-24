Continue implementing Legacy Switch from the spec in .kiro/specs/legacy-switch/ (requirements.md, design.md, tasks.md) and the steering docs in .kiro/steering/.

Implement ONLY Phase 1 (tasks 1-8 in tasks.md): project scaffolding as a monorepo (frontend: Vite + React 18 + TypeScript + Tailwind; backend: Node.js + Hono + TypeScript), Drizzle ORM with SQLite for development and PostgreSQL schema for production, the database schema and initial migration, environment variable setup with .env.local.example, API error handling and middleware, and shared TypeScript types with Zod schemas.

Follow design.md exactly for the schema and structure. Run npm install, then verify with typecheck and lint, and fix any errors until everything is green. Update the task checkboxes in tasks.md for the tasks you complete.

Do NOT implement later phases yet, and do NOT commit anything to git. Keep the scope tight: working skeleton with a verified database connection and passing typecheck/lint.
