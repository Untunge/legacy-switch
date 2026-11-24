import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Environment configuration
 * Design.md: Security section
 */

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./legacy.db',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  DEMO_TIMER_MULTIPLIER: process.env.DEMO_TIMER_MULTIPLIER || '1000',
  NODE_ENV: (process.env.NODE_ENV || 'development') as
    'development' | 'production',
  PORT: parseInt(process.env.PORT || '3000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

export function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !env[key as keyof typeof env]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
