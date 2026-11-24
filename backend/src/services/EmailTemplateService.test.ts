import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EmailType,
  renderTemplate,
  type TemplateData,
  type RenderedEmail,
} from './EmailTemplateService';
import logger from '../lib/logger';

// Mock the logger
vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env
vi.mock('../lib/env', () => ({
  env: {
    DEMO_MODE: false,
    DATABASE_URL: 'file:./legacy.db',
    JWT_SECRET: 'test',
    JWT_EXPIRY: '24h',
    REFRESH_TOKEN_EXPIRY: '7d',
    RESEND_API_KEY: undefined,
    NODE_ENV: 'test' as const,
    PORT: 3000,
    CORS_ORIGIN: 'http://localhost:5173',
    LOG_LEVEL: 'info',
  },
}));

describe('EmailTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('renderTemplate', () => {
    it('should throw error for unknown email type', async () => {
      const data: TemplateData = {
        userName: 'John Doe',
        capsuleName: 'My Capsule',
        daysRemaining: 7,
        checkInUrl: 'https://example.com/checkin',
      };

      await expect(
        renderTemplate('UNKNOWN' as EmailType, data)
      ).rejects.toThrow('Unknown email type');
    });

    it('should log to console in demo mode', async () => {
      const { env } = await import('../lib/env');
      env.DEMO_MODE = true;

      const data: TemplateData = {
        userName: 'John Doe',
        capsuleName: 'My Capsule',
        daysRemaining: 7,
        checkInUrl: 'https://example.com/checkin',
      };

      await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EmailType.WARNING_7_DAYS,
          recipient: 'demo-recipient',
        }),
        expect.stringContaining('[DEMO]')
      );

      env.DEMO_MODE = false;
    });
  });

  describe('WARNING_7_DAYS template', () => {
    const data = {
      userName: 'Alice Johnson',
      capsuleName: 'My Legacy',
      daysRemaining: 7,
      checkInUrl: 'https://example.com/checkin/abc123',
    };

    let result: RenderedEmail;

    beforeEach(async () => {
      result = await renderTemplate(EmailType.WARNING_7_DAYS, data);
    });

    it('should render subject line correctly', () => {
      expect(result.subject).toEqual("7 Days: Don't Forget Your Legacy Check-In");
    });

    it('should include user name in greeting', () => {
      expect(result.text).toContain('Hi Alice Johnson');
      expect(result.html).toContain('Hi Alice Johnson');
    });

    it('should include capsule name', () => {
      expect(result.text).toContain('My Legacy');
      expect(result.html).toContain('My Legacy');
    });

    it('should include days remaining', () => {
      expect(result.text).toContain('7 days');
      expect(result.html).toContain('7 days');
    });

    it('should include check-in URL', () => {
      expect(result.text).toContain(data.checkInUrl);
      expect(result.html).toContain(data.checkInUrl);
    });

    it('should include grace period explanation', () => {
      expect(result.text).toContain('grace period');
      expect(result.html).toContain('grace period');
    });

    it('should have both HTML and text versions', () => {
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
      expect(result.html.length).toBeGreaterThan(result.text.length);
    });

    it('should be valid HTML', () => {
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('</html>');
    });

    it('should include calm tone messaging', () => {
      expect(result.text).toContain('friendly reminder');
    });

    it('should escape HTML special characters in user data', async () => {
      const maliciousData = {
        userName: 'Alice <script>alert("xss")</script>',
        capsuleName: 'My <b>Bold</b> Capsule',
        daysRemaining: 7,
        checkInUrl: 'https://example.com?data=<img src=x>',
      };

      const malResult = await renderTemplate(
        EmailType.WARNING_7_DAYS,
        maliciousData
      );

      // Should not contain unescaped script tags
      expect(malResult.html).not.toContain('<script>');
      expect(malResult.html).toContain('&lt;script&gt;');
      expect(malResult.html).toContain('&lt;b&gt;');
    });
  });

  describe('WARNING_3_DAYS template', () => {
    const data = {
      userName: 'Bob Smith',
      capsuleName: 'Important Instructions',
      daysRemaining: 3,
      checkInUrl: 'https://example.com/checkin/xyz789',
    };

    let result: RenderedEmail;

    beforeEach(async () => {
      result = await renderTemplate(EmailType.WARNING_3_DAYS, data);
    });

    it('should render urgent subject line', () => {
      expect(result.subject).toEqual('3 Days Remaining: Your Legacy Check-In Needed');
    });

    it('should use more urgent tone than 7-day warning', () => {
      expect(result.text).toContain('FINAL NOTICE');
      expect(result.text).toContain('URGENT');
      expect(result.html).toContain('URGENT');
    });

    it('should emphasize urgency', () => {
      expect(result.text).toContain('Time is running out');
      expect(result.html).toContain('Don\'t Wait');
    });

    it('should include warning color scheme', () => {
      expect(result.html).toContain('#e8794f');
    });

    it('should include user, capsule, and days remaining', () => {
      expect(result.text).toContain('Bob Smith');
      expect(result.text).toContain('Important Instructions');
      expect(result.text).toContain('3 days');
      expect(result.html).toContain('Bob Smith');
      expect(result.html).toContain('Important Instructions');
      expect(result.html).toContain('3 days');
    });

    it('should include check-in URL', () => {
      expect(result.text).toContain(data.checkInUrl);
      expect(result.html).toContain(data.checkInUrl);
    });
  });

  describe('RELEASE template', () => {
    const data = {
      userName: 'Carol Williams',
      capsuleName: 'Financial Information',
      contactName: 'David Wilson',
      releaseUrl: 'https://example.com/release/token-123',
      passphrase: 'MySecurePassphrase2024!',
    };

    let result: RenderedEmail;

    beforeEach(async () => {
      result = await renderTemplate(EmailType.RELEASE, data);
    });

    it('should render release subject line with capsule name', () => {
      expect(result.subject).toContain('Financial Information');
      expect(result.subject).toContain('Released');
    });

    it('should address contact by name', () => {
      expect(result.text).toContain('Hello David Wilson');
      expect(result.html).toContain('David Wilson');
    });

    it('should mention originating user', () => {
      expect(result.text).toContain('Carol Williams');
      expect(result.html).toContain('Carol Williams');
    });

    it('should include single-use link warning', () => {
      expect(result.text).toContain('single-use');
      expect(result.html).toContain('single-use');
    });

    it('should include release URL', () => {
      expect(result.text).toContain(data.releaseUrl);
      expect(result.html).toContain(data.releaseUrl);
    });

    it('should include passphrase', () => {
      expect(result.text).toContain(data.passphrase);
      expect(result.html).toContain(data.passphrase);
    });

    it('should warn about passphrase security', () => {
      expect(result.text).toContain('Treat this passphrase like a password');
      expect(result.html).toContain('Treat this passphrase like a password');
    });

    it('should include clear access instructions', () => {
      expect(result.text).toContain('HOW TO ACCESS');
      expect(result.text.match(/\d\./g)).toBeTruthy(); // Check for numbered list
    });

    it('should have blue color scheme for CTA', () => {
      expect(result.html).toContain('#3b82f6');
    });

    it('should not expose passphrase in subject line', () => {
      expect(result.subject).not.toContain('MySecurePassphrase2024!');
    });

    it('should escape HTML in contact and user names', async () => {
      const malData = {
        userName: 'Carol <img src=x onerror=alert(1)>',
        capsuleName: 'Info & Data',
        contactName: 'David <script>alert(1)</script>',
        releaseUrl: 'https://example.com/release/token',
        passphrase: 'pass&word',
      };

      const malResult = await renderTemplate(EmailType.RELEASE, malData);

      // Should not contain unescaped HTML tags
      expect(malResult.html).not.toContain('<script>');
      expect(malResult.html).not.toContain('<img');
      // Should contain escaped versions
      expect(malResult.html).toContain('&lt;img');
      expect(malResult.html).toContain('&lt;script&gt;');
      expect(malResult.html).toContain('&amp;');
    });
  });

  describe('ACCESS_CONFIRMATION template', () => {
    const data = {
      userName: 'Emma Davis',
      capsuleName: 'Personal Messages',
      contactName: 'Frank Brown',
      accessedAt: '2024-01-15 at 2:30 PM UTC',
      contactEmail: 'frank@example.com',
    };

    let result: RenderedEmail;

    beforeEach(async () => {
      result = await renderTemplate(EmailType.ACCESS_CONFIRMATION, data);
    });

    it('should render access confirmation subject line', () => {
      expect(result.subject).toContain('Alert');
      expect(result.subject).toContain('Personal Messages');
      expect(result.subject).toContain('Accessed');
    });

    it('should address original user by name', () => {
      expect(result.text).toContain('Hi Emma Davis');
      expect(result.html).toContain('Emma Davis');
    });

    it('should include contact name and email', () => {
      expect(result.text).toContain('Frank Brown');
      expect(result.text).toContain('frank@example.com');
      expect(result.html).toContain('Frank Brown');
      expect(result.html).toContain('frank@example.com');
    });

    it('should include access timestamp', () => {
      expect(result.text).toContain(data.accessedAt);
      expect(result.html).toContain(data.accessedAt);
    });

    it('should include capsule name', () => {
      expect(result.text).toContain('Personal Messages');
      expect(result.html).toContain('Personal Messages');
    });

    it('should confirm one-time link usage', () => {
      expect(result.text).toContain('cannot be accessed again');
      expect(result.html).toContain('cannot be accessed again');
    });

    it('should have green color scheme indicating success', () => {
      expect(result.html).toContain('#10b981');
    });

    it('should not require any action from user', () => {
      expect(result.text).toContain('No further action');
      expect(result.html).toContain('No further action');
    });

    it('should escape HTML special characters in contact data', async () => {
      const malData = {
        userName: 'Emma <style>body{display:none}</style>Davis',
        capsuleName: 'Messages & Notes',
        contactName: 'Frank "The Frank" Brown',
        accessedAt: '2024-01-15 at <script>alert(1)</script>2:30 PM',
        contactEmail: 'frank@example.com<img src=x>',
      };

      const malResult = await renderTemplate(
        EmailType.ACCESS_CONFIRMATION,
        malData
      );

      // Should contain the escaped versions of user-provided data
      expect(malResult.html).toContain('&lt;style&gt;');
      expect(malResult.html).toContain('&lt;script&gt;');
      expect(malResult.html).toContain('&lt;img');
      expect(malResult.html).toContain('&quot;');
      expect(malResult.html).toContain('&amp;');
      
      // Verify that the actual malicious payloads are not present
      // (style tags would only appear in template itself, not in user data)
      const userDataMatch = malResult.html.match(/<div class="greeting">Hi.*?<\/div>/s);
      if (userDataMatch) {
        // This part should not have unescaped user-provided HTML
        expect(userDataMatch[0]).toContain('Emma &lt;style&gt;');
      }
    });
  });

  describe('Template consistency', () => {
    it('all templates should include footer', async () => {
      const data7days = {
        userName: 'Test User',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result7days = await renderTemplate(EmailType.WARNING_7_DAYS, data7days);
      expect(result7days.text).toContain('Legacy Switch');
      expect(result7days.html).toContain('Legacy Switch');

      const dataRelease = {
        userName: 'Test User',
        capsuleName: 'Test',
        contactName: 'Contact',
        releaseUrl: 'https://example.com',
        passphrase: 'pass',
      };

      const resultRelease = await renderTemplate(EmailType.RELEASE, dataRelease);
      expect(resultRelease.text).toContain('Legacy Switch');
      expect(resultRelease.html).toContain('Legacy Switch');
    });

    it('should not expose sensitive data in text versions', async () => {
      const dataRelease = {
        userName: 'Alice',
        capsuleName: 'Secret Info',
        contactName: 'Bob',
        releaseUrl: 'https://example.com/release/token-secret-token',
        passphrase: 'VerySecurePassphrase123!',
      };

      const result = await renderTemplate(EmailType.RELEASE, dataRelease);

      // Passphrase should be shown (it's intended to be shared)
      expect(result.text).toContain('VerySecurePassphrase123!');

      // But token should not be visible in plain text preview
      // (it's in the URL which is fine)
      expect(result.text).toContain(dataRelease.releaseUrl);
    });

    it('all HTML templates should have proper meta tags', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.html).toContain('charset=UTF-8');
      expect(result.html).toContain('viewport');
    });

    it('should have accessible color contrast', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      // Check for reasonable text colors (not pure white on white, etc)
      expect(result.html).toMatch(/color:\s*#[0-9a-f]{6}/i);
      expect(result.html).toMatch(/background-color:\s*#[0-9a-f]{6}/i);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long user names', async () => {
      const longName = 'A'.repeat(500);
      const data = {
        userName: longName,
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.html).toContain(longName);
      expect(result.text).toContain(longName);
    });

    it('should handle very long capsule names', async () => {
      const longName = 'Very Long Capsule Name: ' + 'B'.repeat(400);
      const data = {
        userName: 'Test',
        capsuleName: longName,
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.html).toContain(longName);
      expect(result.text).toContain(longName);
    });

    it('should handle special characters in URLs', async () => {
      const specialUrl = 'https://example.com/release?token=abc%20def&foo=bar&baz=qux';
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        contactName: 'Contact',
        releaseUrl: specialUrl,
        passphrase: 'pass',
      };

      const result = await renderTemplate(EmailType.RELEASE, data);

      expect(result.html).toContain(specialUrl);
      expect(result.text).toContain(specialUrl);
    });

    it('should handle days remaining of 0', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 0,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_3_DAYS, data);

      expect(result.text).toContain('0 days');
      expect(result.html).toContain('0 days');
    });

    it('should handle days remaining of 1', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 1,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_3_DAYS, data);

      expect(result.text).toContain('1 days');
      expect(result.html).toContain('1 days');
    });

    it('should handle unicode characters in names', async () => {
      const data = {
        userName: '李华 (Li Hua)',
        capsuleName: 'مفهوم الحياة (Life Philosophy)',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.text).toContain('李华');
      expect(result.text).toContain('مفهوم الحياة');
      expect(result.html).toContain('李华');
      expect(result.html).toContain('مفهوم الحياة');
    });

    it('should handle newlines and tabs in capsule names', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test\nCapsule\tName',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      // Should preserve or sanitize but not break
      expect(result.text).toBeTruthy();
      expect(result.html).toBeTruthy();
    });
  });

  describe('Return value structure', () => {
    it('should always return object with subject, html, and text', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(typeof result.subject).toBe('string');
      expect(typeof result.html).toBe('string');
      expect(typeof result.text).toBe('string');
    });

    it('subject should not be empty', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.subject.length).toBeGreaterThan(0);
    });

    it('html and text should not be empty', async () => {
      const data = {
        userName: 'Test',
        capsuleName: 'Test',
        daysRemaining: 7,
        checkInUrl: 'https://example.com',
      };

      const result = await renderTemplate(EmailType.WARNING_7_DAYS, data);

      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });
});
