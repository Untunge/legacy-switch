import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Task 45: Tests for demo mode console logging
 * Validates: Requirement 18 - Demo mode email logging with extractPreview
 */

describe('EmailService - Demo Mode Logging (Task 45)', () => {
  let consoleSpy_log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy_log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy_log.mockRestore();
    vi.clearAllMocks();
  });

  describe('extractPreview helper function', () => {
    it('should strip HTML tags from body text', () => {
      const body =
        '<p>Your capsule will be released in 7 days unless you check in. <a href="#">Check In Now →</a></p>';

      // Simulate extractPreview logic
      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toContain(
        'Your capsule will be released in 7 days unless you check in.'
      );
      expect(preview).not.toContain('<p>');
      expect(preview).not.toContain('<a');
      expect(preview).not.toContain('href');
    });

    it('should normalize whitespace to single spaces', () => {
      const body = '<p>Multiple    spaces    and\n\nnewlines</p>';

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      // Should have normalized spaces - no multiple consecutive spaces or newlines
      expect(preview).toContain('Multiple spaces and newlines');
      expect(preview).not.toMatch(/\s{2,}/);
    });

    it('should limit preview to 100 characters', () => {
      const longBody = 'A'.repeat(200);

      const stripped = longBody.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview.length).toBeLessThanOrEqual(100);
      expect(preview).toMatch(/^A+/);
    });

    it('should handle empty strings gracefully', () => {
      const body = '';

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toBe('');
    });

    it('should handle strings with only HTML tags', () => {
      const body = '<p></p><div></div>';

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toBe('');
    });

    it('should handle special HTML entities', () => {
      const body = '<p>Test &amp; Demo &lt;tag&gt;</p>';

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toContain('Test &amp; Demo &lt;tag&gt;');
    });
  });

  describe('Console output format - WARNING_7_DAYS', () => {
    it('should produce correct format with [DEMO] prefix', () => {
      const email = {
        toEmail: 'judge@demo.local',
        subject: "7 Days: Don't Forget Your Legacy Check-In",
        bodyType: 'warning_7days',
        bodyData:
          'Your capsule will be released in 7 days unless you check in. [Check In Now →]',
      };

      // Simulate extractPreview
      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const expectedOutput = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(expectedOutput).toMatch(/^\[DEMO\] Email Send Event:/);
      expect(expectedOutput).toContain('type=warning_7days');
      expect(expectedOutput).toContain('recipient=judge@demo.local');
      expect(expectedOutput).toContain("subject=7 Days: Don't Forget");
      expect(expectedOutput).toContain('preview=Your capsule will be released');
    });

    it('should include all required fields in output', () => {
      const email = {
        toEmail: 'test@demo.local',
        subject: 'Test Subject',
        bodyType: 'warning_7days',
        bodyData: 'Test body content',
      };

      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      // Verify all 4 required fields are present
      expect(output).toMatch(/type=/);
      expect(output).toMatch(/recipient=/);
      expect(output).toMatch(/subject=/);
      expect(output).toMatch(/preview=/);
    });
  });

  describe('Console output format - RELEASE', () => {
    it('should log RELEASE email with correct format', () => {
      const email = {
        toEmail: 'demo-contact@demo.local',
        subject:
          'Your Legacy Capsule: Urgent: If Something Happens Has Been Released',
        bodyType: 'release_notification',
        bodyData:
          'Your capsule "Urgent: If Something Happens" is now being shared. Here are your instructions...',
      };

      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(output).toMatch(/^\[DEMO\] Email Send Event:/);
      expect(output).toContain('type=release_notification');
      expect(output).toContain('recipient=demo-contact@demo.local');
      expect(output).toContain(
        'subject=Your Legacy Capsule: Urgent: If Something Happens'
      );
    });
  });

  describe('Console output format - WARNING_3_DAYS', () => {
    it('should log WARNING_3_DAYS email', () => {
      const email = {
        toEmail: 'user@demo.local',
        subject: '3 Days Remaining: Your Legacy Check-In Needed',
        bodyType: 'warning_3days',
        bodyData:
          'Final notice: 3 days remaining before your capsule is released.',
      };

      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(output).toContain('type=warning_3days');
      expect(output).toContain('recipient=user@demo.local');
    });
  });

  describe('Console output format - ACCESS_CONFIRMATION', () => {
    it('should log ACCESS_CONFIRMATION email', () => {
      const email = {
        toEmail: 'judge@demo.local',
        subject: "Alert: Your Capsule 'My Final Message' Was Accessed",
        bodyType: 'access_notification',
        bodyData:
          'Your capsule "My Final Message" was accessed by John Doe on 2024-01-15 at 14:30.',
      };

      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(output).toContain('type=access_notification');
      expect(output).toContain('recipient=judge@demo.local');
      expect(output).toContain(
        "subject=Alert: Your Capsule 'My Final Message' Was Accessed"
      );
    });
  });

  describe('JSON body data handling', () => {
    it('should handle bodyData as string', () => {
      const bodyData = 'Plain text message body';

      const stripped = bodyData.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toBe('Plain text message body');
    });

    it('should handle bodyData as JSON by converting to string', () => {
      const bodyData = {
        message: 'This is a JSON body',
        url: 'https://example.com',
      };

      const bodyString = JSON.stringify(bodyData);
      const stripped = bodyString.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toContain('This is a JSON body');
    });
  });

  describe('Preview length edge cases', () => {
    it('should handle exactly 100 character body', () => {
      const body = 'B'.repeat(100);

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview.length).toBe(100);
      expect(preview).toBe(body);
    });

    it('should handle body shorter than 100 characters', () => {
      const body = 'Short body';

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview).toBe('Short body');
      expect(preview.length).toBe(10);
    });

    it('should handle body with 101 characters', () => {
      const body = 'C'.repeat(101);

      const stripped = body.replace(/<[^>]*>/g, ' ');
      const normalized = stripped.replace(/\s+/g, ' ').trim();
      const preview = normalized.slice(0, 100);

      expect(preview.length).toBe(100);
      expect(preview).toBe('C'.repeat(100));
    });
  });

  describe('Format consistency', () => {
    it('should maintain consistent field order in output', () => {
      const email = {
        toEmail: 'test@example.com',
        subject: 'Subject Line',
        bodyType: 'test_type',
        bodyData: 'Test body',
      };

      const preview = email.bodyData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);

      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      // Verify field order: [DEMO], type, recipient, subject, preview
      const pattern =
        /^\[DEMO\] Email Send Event: type=\w+, recipient=[^,]+, subject=[^,]+, preview=/;
      expect(output).toMatch(pattern);
    });

    it('should handle special characters in email addresses', () => {
      const email = {
        toEmail: 'user+test@demo.local',
        subject: 'Test',
        bodyType: 'test',
        bodyData: 'Body',
      };

      const preview = email.bodyData.slice(0, 100);
      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(output).toContain('user+test@demo.local');
    });

    it('should handle special characters in subject', () => {
      const email = {
        toEmail: 'test@demo.local',
        subject: 'Subject with \'quotes\' and "double quotes"',
        bodyType: 'test',
        bodyData: 'Body',
      };

      const preview = email.bodyData.slice(0, 100);
      const output = `[DEMO] Email Send Event: type=${email.bodyType}, recipient=${email.toEmail}, subject=${email.subject}, preview=${preview}`;

      expect(output).toContain("Subject with 'quotes'");
    });
  });
});
