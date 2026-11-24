/**
 * API request and response types
 * Design.md: API Design section
 */

// Auth endpoints
export interface SignupRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  token: string;
}

// Capsule endpoints
export interface CreateCapsuleRequest {
  title: string;
  encryptedContent: string;
  contentHash: string;
}

export interface UpdateCapsuleRequest {
  title?: string;
  encryptedContent?: string;
  contentHash?: string;
}

export interface CapsuleResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  timerStatus?: string;
  nextReleaseAt?: string;
}

// Check-in endpoint
export interface CheckinRequest {
  capsuleId: string;
}

export interface CheckinResponse {
  success: boolean;
  nextReleaseAt: string;
}

// Contact endpoints
export interface AddContactRequest {
  capsuleId: string;
  email: string;
  name?: string;
  passphrase: string;
}

export interface ContactResponse {
  id: string;
  email: string;
  name?: string;
  released: boolean;
}

// Release endpoints
export interface ReleasePreviewRequest {
  token: string;
  passphrase: string;
}

export interface ReleasePreviewResponse {
  capsuleId: string;
  title: string;
  releasedBy: string;
  releasedAt: string;
  content?: string; // Only if decryption successful
}

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
