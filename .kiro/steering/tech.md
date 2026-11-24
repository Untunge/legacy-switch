# Legacy Switch — Technology Stack & Conventions

## Stack Decisions

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Fetch API + TanStack React Query
- **Routing**: TanStack React Router
- **Form**: React Hook Form + Zod
- **Crypto**: WebCrypto API (native)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Hono
- **Database**: SQLite (dev), Postgres (prod)
- **ORM**: Drizzle
- **Scheduler**: node-cron + in-memory queue
- **Email**: Resend API
- **Auth**: JWT tokens

### Authentication & Encryption
- **User Auth**: Email + bcrypt (12+ rounds)
- **Session**: JWT (httpOnly cookie)
- **Passphrase**: PBKDF2 (100k iterations)
- **Encryption**: AES-GCM 256-bit
- **Never on Server**: Passwords, passphrases, decrypted contents
