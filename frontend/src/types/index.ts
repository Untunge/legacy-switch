// API Response types
export interface AuthResponse {
  success: boolean;
  data: {
    userId: string;
    email: string;
  };
}

export interface SessionResponse {
  success: boolean;
  data: {
    userId: string;
    email: string;
  };
}

export interface CapsuleResponse {
  success: boolean;
  data: Capsule;
}

export interface CapsuleListResponse {
  success: boolean;
  data: Capsule[];
}

export interface CheckInResponse {
  success: boolean;
  data: {
    nextReleaseAt: string;
  };
}

export interface ContactResponse {
  success: boolean;
  data: Contact;
}

export interface ContactListResponse {
  success: boolean;
  data: Contact[];
}

export interface AuditLogResponse {
  success: boolean;
  data: AuditLogEntry[];
}

// Domain types
export interface User {
  userId: string;
  email: string;
}

export interface Capsule {
  id: string;
  title: string;
  description?: string;
  encryptedContent: string; // Base64 or plaintext for Phase 3
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
}

export interface Timer {
  id: string;
  capsuleId: string;
  interval: 'daily' | 'weekly' | 'monthly';
  lastCheckin: string;
  nextRelease: string;
  graceEndsAt?: string;
  state: 'active' | 'grace_period' | 'released';
  warned7Days: boolean;
  warned3Days: boolean;
}

export interface Contact {
  id: string;
  capsuleId: string;
  email: string;
  name?: string;
  released: boolean;
  releasedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  timestamp: string;
  hashOfPrevious?: string;
  tampered?: boolean;
}

export interface CapsuleWithTimer extends Capsule {
  timer?: Timer;
}

export type TimerInterval = 'daily' | 'weekly' | 'monthly';
