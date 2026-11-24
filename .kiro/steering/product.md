# Legacy Switch — Product Definition

## Vision
A simple, affordable digital dead man's switch that lets users securely store personal legacy information (messages, account lists, instructions) and have it automatically released to trusted contacts if they stop checking in.

## Problem
When people die or go missing, critical information is lost: passwords, final messages, important documents, instructions for family. Existing solutions (lawyers, safe deposit boxes, password manager emergency access) are expensive, complex, or unknown to everyday users.

## Who It's For
- Individuals who want peace of mind knowing their legacy is safe and their loved ones are prepared
- People in uncertain situations (travel, activism, health concerns) who need a low-barrier dead man's switch
- Anyone who wants to leave instructions without hiring a lawyer

## Core Principles
1. **Privacy First**: Truly end-to-end encrypted. The server can never read capsule contents.
2. **Simplicity**: No jargon. Clear, calming UX that respects the seriousness of the subject.
3. **Accessibility**: Works on any device. Free or very cheap. No technical knowledge required.
4. **Transparency**: All mechanics visible to the user. No hidden behavior.
5. **Auditable**: Every action logged. Contacts can verify they received legitimate releases.

## MVP Scope
- **Accounts & Login**: Email-based authentication.
- **Capsules**: Create, edit, delete encrypted containers. Hold text messages and file attachments.
- **End-to-End Encryption**: Passphrase-based key derivation (PBKDF2). AES-GCM encryption/decryption in the browser.
- **Check-in & Timer**: User checks in to extend timer. Configurable intervals (daily/weekly/monthly). Grace period (7 days) before automated release.
- **Trusted Contacts**: Assign contacts per capsule. They receive one-time-use release links and a passphrase to open.
- **Dashboard**: View timer status, all capsules, check-in history. Visual "candle" metaphor shows urgency.
- **Staged Warnings**: Email alerts at T-7 days, T-3 days before release. Clear call-to-action to check in.
- **Demo Mode**: Accelerated timers (minutes instead of days). Demo account with pre-populated data for judges.

## Success Metrics
- User can create and encrypt a capsule without leaving the browser.
- Server can never decrypt a capsule (even if compromised).
- Contacts can open released capsules with a one-time link and passphrase.
- Timer ticks accurately and releases capsules on schedule.
- All key events are logged and cannot be modified.

## Out of Scope (Phase 2+)
- Biometric unlock
- Video/media playback in capsules
- Scheduled partial releases
- User-to-user messaging
- Multi-language support
