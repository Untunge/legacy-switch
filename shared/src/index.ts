/**
 * Legacy Switch - Shared Types
 * This package contains types shared between frontend and backend
 */

// API Contract Types
export interface ApiUser {
  id: string;
  email: string;
}

export interface ApiCapsule {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTimer {
  capsuleId: string;
  status: 'active' | 'grace_period' | 'released';
  nextReleaseAt: string;
  interval: 'day' | 'week' | 'month';
}

export interface ApiContact {
  id: string;
  email: string;
  name?: string;
  released: boolean;
}

// Demo mode flag
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Timer acceleration for demo
export const TIMER_MULTIPLIER = DEMO_MODE ? 1000 : 1;

// Demo credentials
export const DEMO_CREDENTIALS = {
  email: 'judge@demo.local',
  password: 'demo',
};
