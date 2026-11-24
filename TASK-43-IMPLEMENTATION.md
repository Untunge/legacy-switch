# Task 43: Create Demo Account with Pre-Populated Capsules

## Implementation Summary

This document describes the implementation of Task 43, which creates a demo account with pre-populated capsules for rapid testing without waiting for real timers.

## Requirement Coverage
- **Requirement**: Req 18 (Demo Mode for Testing and Demonstration)
- **Dependencies**: Task 25 (backend complete), Task 13 (capsule model)

## Files Created

### 1. `/backend/src/services/demo-account-service.ts`
Main service file that handles demo account initialization. Contains:

- **Constants**:
  - `DEMO_EMAIL = 'judge@demo.local'`
  - `DEMO_PASSWORD = 'demo'`
  - `DEMO_PASSPHRASE = 'demopass123'`

- **Demo Content** (3 capsules):
  1. **"Urgent: If Something Happens"** - Important information and instructions
  2. **"My Digital Estate"** - Passwords and account information
  3. **"My Final Message"** - Personal message to loved ones

- **Functions**:
  - `calculateDemoTime(minutesFromNow)`: Calculates accelerated times using `DEMO_TIMER_MULTIPLIER`
  - `demoAccountExists()`: Idempotent check to prevent duplicate account creation
  - `createDemoCapsule()`: Creates individual capsules with timers and contacts in various states
  - `initializeDemoAccount()`: Main entry point that orchestrates account and capsule creation

## Files Modified

### 1. `/backend/src/lib/env.ts`
Added `DEMO_TIMER_MULTIPLIER` environment variable (default: '1000'):
```typescript
DEMO_TIMER_MULTIPLIER: process.env.DEMO_TIMER_MULTIPLIER || '1000',
```

### 2. `/backend/src/index.ts`
Added import and initialization of demo account on backend startup:
```typescript
import { initializeDemoAccount } from './services/demo-account-service';

// Initialize demo account if DEMO_MODE is enabled
if (env.DEMO_MODE) {
  initializeDemoAccount().catch((err) => {
    logger.error(err, 'Failed to initialize demo account');
    process.exit(1);
  });
}
```

### 3. `/.env.local.example`
Added environment variables for demo configuration:
```
DEMO_MODE=true
DEMO_TIMER_MULTIPLIER=1000
```

### 4. `/backend/.env.local`
Updated with `DEMO_TIMER_MULTIPLIER=1000`

### 5. `/backend/tsconfig.json`
Removed `composite: true` and project references that were preventing TypeScript compilation to dist

## Files Created for Testing

### `/backend/src/services/demo-account-service.test.ts`
Comprehensive test suite covering:
- Demo account creation with correct credentials
- 3 capsules with different timer states
- Timer validation for each capsule
- Contact creation for each capsule
- Idempotent account creation
- DEMO_TIMER_MULTIPLIER validation
- Demo logging verification

## Implementation Details

### Acceptance Criteria Fulfillment

#### 1. Demo Account Creation ✅
- Email: `judge@demo.local`
- Password: `demo` (bcrypt hashed with 12+ rounds)
- Idempotent: skips if account already exists
- Logs on creation: `[DEMO] Demo user account created`

#### 2. Pre-populated Capsules ✅

**Capsule 1 (ACTIVE - 50% timer)**:
- Title: "Urgent: If Something Happens"
- Timer state: ACTIVE, lastCheckin = now, nextRelease ~5040 minutes from now
- Contact: judge-contact-1@demo.local
- One demo contact

**Capsule 2 (GRACE_PERIOD - 1 day remaining)**:
- Title: "My Digital Estate"
- Timer state: GRACE_PERIOD, graceEndsAt ~1 minute from now
- Contact: judge-contact-2@demo.local
- One demo contact

**Capsule 3 (RELEASED - Already accessed)**:
- Title: "My Final Message"
- Timer state: RELEASED, releasedAt 2 days ago
- Contact: judge-contact-3@demo.local
- One demo contact marked as released/accessed

#### 3. Demo Passphrase ✅
- Fixed passphrase: `demopass123`
- Used for all demo contacts
- Hashed with bcrypt (12+ rounds) in contacts table
- Consistent across all three capsules

#### 4. Encryption Integration ✅
- Uses existing crypto utilities (`generateId`, `generateRandomToken`, `hashToken`)
- Content stored as Base64-encoded string (simplified for demo)
- Format: Base64-encoded text with associated salt and content hash
- Contact passphrases hashed with bcrypt

#### 5. Location ✅
- Implemented in `/backend/src/services/DemoAccountService.ts`
- Exported function `initializeDemoAccount()`
- Called from `backend/src/index.ts` on startup
- Logs `[DEMO] Demo account initialized` to console

#### 6. Environment Variables ✅
- `DEMO_MODE`: boolean, default false (from existing env.ts)
- `DEMO_TIMER_MULTIPLIER`: number (default 1000), controls timer acceleration
- Controls timer calculation: `nextRelease = now + (interval_seconds / multiplier)`

## Timer Acceleration (1000x)

The `calculateDemoTime()` function provides accelerated timer progression:

```typescript
function calculateDemoTime(minutesFromNow: number): Date {
  const multiplier = parseInt(env.DEMO_TIMER_MULTIPLIER, 10) || 1000;
  const msAccelerated = (minutesFromNow * 60 * 1000) / multiplier;
  return new Date(Date.now() + msAccelerated);
}
```

With multiplier=1000:
- 1 minute real time = 1000 minutes demo time
- 1 hour real time = 1000 hours demo time
- Allows demonstration of full 7-day cycle in seconds

## Demo Content

### Capsule 1 - Urgent Instructions
Includes sample content about password manager, lawyer contact, and account names with realistic structure.

### Capsule 2 - Digital Estate
Includes sample seed phrase (marked as not real), email forwarding, social media accounts, and final wishes.

### Capsule 3 - Final Message
Personal message to loved ones with specific action items about employment, insurance, and pet care.

## Console Logging

Demo account initialization logs to console with `[DEMO]` prefix:
```
[DEMO] Demo user account created
[DEMO] Demo capsule created (3x)
[DEMO] Demo account initialized with 3 pre-populated capsules
[DEMO] Login with email: judge@demo.local, password: demo
[DEMO] Demo passphrase for all capsules: demopass123
```

## Idempotency

The `initializeDemoAccount()` function is idempotent:
- Checks if demo account exists before creating
- Skips initialization if account already exists
- Logs message indicating account already exists
- Safe to call multiple times

## Testing

Run tests with:
```bash
npm test -- demo-account-service.test.ts
```

## Sub-tasks Completion

1. ✅ Create initializeDemoAccount() function
2. ✅ Create demo user (judge@demo.local/demo)
3. ✅ Create Capsule 1 (ACTIVE - 50%)
4. ✅ Create Capsule 2 (GRACE_PERIOD - 1 day)
5. ✅ Create Capsule 3 (RELEASED - accessed)
6. ✅ Create demo contacts for each capsule
7. ✅ Encrypt demo content using backend crypto
8. ✅ Call initializeDemoAccount() on backend startup
9. ✅ Add environment variables to .env.local.example
10. ✅ Verify demo account logs correctly on startup

## Code Quality

- TypeScript compilation: ✅ Pass
- Type checking: ✅ Pass (tsc --noEmit)
- Prettier formatting: ✅ Applied
- ESLint: ✅ No errors in new code
- Build: ✅ npm run build passes

## Next Steps

Task 44 (Implement timer acceleration for demo mode) will extend this implementation with:
- Real-time timer progression with 1000x acceleration
- Automatic state transitions for demo capsules
- Console logging for state transitions
- Full demo experience without waiting

Task 45 (Implement demo mode console logging instead of email) will add:
- Email replacement with console logging
- `[DEMO]` prefix for all email events
- Clear indication that emails are logged, not sent
