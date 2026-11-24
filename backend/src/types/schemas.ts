import { z } from 'zod';

/**
 * Zod validation schemas for all inputs
 * Design.md: Input validation, error handling
 */

// Email and password validation
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

// Auth schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Capsule schemas
export const createCapsuleSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters'),
  encryptedContent: z.string().min(1, 'Encrypted content is required'),
  contentHash: z.string().min(1, 'Content hash is required'),
});

export const updateCapsuleSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  encryptedContent: z
    .string()
    .min(1, 'Encrypted content is required')
    .optional(),
  contentHash: z.string().min(1, 'Content hash is required').optional(),
});

// Check-in schema
export const checkinSchema = z.object({
  capsuleId: z.string().min(1, 'Capsule ID is required'),
});

// Contact schemas
export const addContactSchema = z.object({
  capsuleId: z.string().min(1, 'Capsule ID is required'),
  email: emailSchema,
  name: z.string().max(255, 'Name must not exceed 255 characters').optional(),
  passphrase: z
    .string()
    .min(8, 'Passphrase must be at least 8 characters')
    .max(255, 'Passphrase must not exceed 255 characters'),
});

// Release schemas
export const releasePreviewSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  passphrase: z.string().min(1, 'Passphrase is required'),
});

// Timer interval enum
export const timerIntervalSchema = z.enum(['day', 'week', 'month']);

// Export inferred types
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCapsuleInput = z.infer<typeof createCapsuleSchema>;
export type UpdateCapsuleInput = z.infer<typeof updateCapsuleSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type AddContactInput = z.infer<typeof addContactSchema>;
export type ReleasePreviewInput = z.infer<typeof releasePreviewSchema>;
export type SchemaTimerInterval = z.infer<typeof timerIntervalSchema>;
