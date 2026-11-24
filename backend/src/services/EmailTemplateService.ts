import logger from '../lib/logger';
import { env } from '../lib/env';

/**
 * Email Template Service
 * Design.md: Email notifications at T-7, T-3 days, release, and access confirmation
 * Task 41: Implement email template engine and notification types
 *
 * Renders email templates with dynamic data and supports demo mode (console logging)
 */

/**
 * Email types that the system sends
 */
export enum EmailType {
  WARNING_7_DAYS = 'WARNING_7_DAYS',
  WARNING_3_DAYS = 'WARNING_3_DAYS',
  RELEASE = 'RELEASE',
  ACCESS_CONFIRMATION = 'ACCESS_CONFIRMATION',
}

/**
 * Template data for WARNING_7_DAYS emails
 */
interface Warning7DaysData {
  userName: string;
  capsuleName: string;
  daysRemaining: number;
  checkInUrl: string;
}

/**
 * Template data for WARNING_3_DAYS emails
 */
interface Warning3DaysData {
  userName: string;
  capsuleName: string;
  daysRemaining: number;
  checkInUrl: string;
}

/**
 * Template data for RELEASE emails
 */
interface ReleaseData {
  userName: string;
  capsuleName: string;
  contactName: string;
  releaseUrl: string;
  passphrase: string;
}

/**
 * Template data for ACCESS_CONFIRMATION emails
 */
interface AccessConfirmationData {
  userName: string;
  capsuleName: string;
  contactName: string;
  accessedAt: string;
  contactEmail: string;
}

/**
 * Union type of all possible template data
 */
export type TemplateData =
  Warning7DaysData | Warning3DaysData | ReleaseData | AccessConfirmationData;

/**
 * Result of rendering a template
 */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Renders an email template with the provided data
 * @param type - The email template type
 * @param data - Template data (type-specific)
 * @returns Promise resolving to rendered email with subject, HTML, and plain text
 */
export async function renderTemplate(
  type: EmailType,
  data: TemplateData
): Promise<RenderedEmail> {
  let result: RenderedEmail;

  switch (type) {
    case EmailType.WARNING_7_DAYS:
      result = renderWarning7Days(data as Warning7DaysData);
      break;
    case EmailType.WARNING_3_DAYS:
      result = renderWarning3Days(data as Warning3DaysData);
      break;
    case EmailType.RELEASE:
      result = renderRelease(data as ReleaseData);
      break;
    case EmailType.ACCESS_CONFIRMATION:
      result = renderAccessConfirmation(data as AccessConfirmationData);
      break;
    default:
      throw new Error(`Unknown email type: ${type}`);
  }

  // Demo mode: log to console instead of queuing
  if (env.DEMO_MODE) {
    const preview = result.html.substring(0, 100).replace(/\s+/g, ' ');
    logger.info(
      {
        type,
        recipient: 'demo-recipient',
        subject: result.subject,
        preview,
      },
      '[DEMO] Email Send Event'
    );
  }

  return result;
}

/**
 * Renders WARNING_7_DAYS template
 * Subject: "7 Days: Don't Forget Your Legacy Check-In"
 */
function renderWarning7Days(data: Warning7DaysData): RenderedEmail {
  const subject = "7 Days: Don't Forget Your Legacy Check-In";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=UTF-8>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f7f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #d4a574 0%, #c99052 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555;
      margin-bottom: 24px;
    }
    .capsule-info {
      background-color: #fef5f0;
      border-left: 4px solid #d4a574;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .capsule-name {
      font-weight: 600;
      color: #333;
      font-size: 15px;
    }
    .capsule-detail {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #d4a574 0%, #c99052 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s ease;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .footer {
      background-color: #f9f7f4;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #888;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #d4a574;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏳ Important Reminder</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${escapeHtml(data.userName)},</div>
      <div class="message">
        Your legacy capsule is scheduled to be released in <strong>${data.daysRemaining} days</strong>. 
        This is a friendly reminder to check in and confirm you're okay. 
        Your regular check-in extends the timer and prevents the release.
      </div>
      <div class="capsule-info">
        <div class="capsule-name">📦 ${escapeHtml(data.capsuleName)}</div>
        <div class="capsule-detail">Time remaining: ${data.daysRemaining} days</div>
      </div>
      <div class="message">
        Simply click the button below to check in. It only takes a second, and it will give you peace of mind.
      </div>
      <div class="cta-section">
        <a href="${data.checkInUrl}" class="cta-button">Check In Now</a>
      </div>
      <div class="message" style="font-size: 13px; color: #888; margin-top: 32px;">
        If you don't check in, your capsule will be released to your trusted contacts after the timer expires 
        and the grace period (7 additional days) has passed.
      </div>
    </div>
    <div class="footer">
      <p>Legacy Switch — Secure Digital Legacy Management</p>
      <p>This is an automated reminder email. Please do not reply to this address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your Legacy Check-In Reminder

Hi ${data.userName},

Your legacy capsule is scheduled to be released in ${data.daysRemaining} days. 
This is a friendly reminder to check in and confirm you're okay.

Capsule: ${data.capsuleName}
Time remaining: ${data.daysRemaining} days

Simply visit the link below to check in. It only takes a second:

${data.checkInUrl}

If you don't check in, your capsule will be released to your trusted contacts after 
the timer expires and the grace period (7 additional days) has passed.

---
Legacy Switch — Secure Digital Legacy Management
This is an automated reminder email. Please do not reply to this address.
  `.trim();

  return { subject, html, text };
}

/**
 * Renders WARNING_3_DAYS template
 * Subject: "3 Days Remaining: Your Legacy Check-In Needed"
 */
function renderWarning3Days(data: Warning3DaysData): RenderedEmail {
  const subject = '3 Days Remaining: Your Legacy Check-In Needed';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=UTF-8>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f7f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #e8794f 0%, #d4604a 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555;
      margin-bottom: 24px;
    }
    .urgent-notice {
      background-color: #fef0ed;
      border-left: 4px solid #e8794f;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
      font-weight: 600;
      color: #d4604a;
    }
    .capsule-info {
      background-color: #fef5f0;
      border-left: 4px solid #e8794f;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .capsule-name {
      font-weight: 600;
      color: #333;
      font-size: 15px;
    }
    .capsule-detail {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #e8794f 0%, #d4604a 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s ease;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .footer {
      background-color: #f9f7f4;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #888;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #e8794f;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Urgent: Check-In Required</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${escapeHtml(data.userName)},</div>
      <div class="urgent-notice">
        ⏰ Your legacy capsule will be released in just ${data.daysRemaining} days unless you check in now.
      </div>
      <div class="message">
        This is your final notice before automatic release. Time is running out! 
        Your legacy capsule will be shared with your trusted contacts unless you confirm 
        that you're alive and well by checking in today.
      </div>
      <div class="capsule-info">
        <div class="capsule-name">📦 ${escapeHtml(data.capsuleName)}</div>
        <div class="capsule-detail">🚨 URGENT: Only ${data.daysRemaining} days remaining</div>
      </div>
      <div class="cta-section">
        <a href="${data.checkInUrl}" class="cta-button">Check In Now - Don't Wait</a>
      </div>
      <div class="message" style="font-size: 13px; color: #888; margin-top: 32px;">
        If you do not check in within the next ${data.daysRemaining} days, your capsule will automatically 
        be released to your designated trusted contacts after a grace period of 7 additional days.
      </div>
    </div>
    <div class="footer">
      <p>Legacy Switch — Secure Digital Legacy Management</p>
      <p>This is an automated reminder email. Please do not reply to this address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
URGENT: Your Legacy Check-In is Required

Hi ${data.userName},

⏰ Your legacy capsule will be released in just ${data.daysRemaining} days unless you check in now.

This is your FINAL NOTICE before automatic release. Time is running out!

Capsule: ${data.capsuleName}
🚨 URGENT: Only ${data.daysRemaining} days remaining

Please visit the link below immediately to check in:

${data.checkInUrl}

If you do not check in within the next ${data.daysRemaining} days, your capsule will 
automatically be released to your designated trusted contacts after a grace period 
of 7 additional days.

---
Legacy Switch — Secure Digital Legacy Management
This is an automated reminder email. Please do not reply to this address.
  `.trim();

  return { subject, html, text };
}

/**
 * Renders RELEASE template
 * Subject: "Your Legacy Capsule: {capsuleName} Has Been Released"
 */
function renderRelease(data: ReleaseData): RenderedEmail {
  const subject = `Your Legacy Capsule: ${escapeHtml(data.capsuleName)} Has Been Released`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=UTF-8>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f7f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555;
      margin-bottom: 24px;
    }
    .notice {
      background-color: #f3f4f6;
      border-left: 4px solid #6b7280;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .notice-title {
      font-weight: 600;
      color: #333;
      font-size: 15px;
      margin-bottom: 8px;
    }
    .notice-text {
      font-size: 14px;
      color: #666;
    }
    .capsule-info {
      background-color: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .capsule-name {
      font-weight: 600;
      color: #333;
      font-size: 15px;
      display: flex;
      align-items: center;
    }
    .capsule-name::before {
      content: '📦';
      margin-right: 8px;
    }
    .capsule-detail {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .passphrase-section {
      background-color: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 6px;
    }
    .passphrase-label {
      font-weight: 600;
      color: #d97706;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .passphrase-value {
      background-color: #ffffff;
      border: 1px solid #f59e0b;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 15px;
      word-break: break-all;
      color: #333;
      margin-bottom: 8px;
    }
    .passphrase-warning {
      font-size: 12px;
      color: #d97706;
      margin-top: 8px;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s ease;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .instructions {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 16px;
      margin: 24px 0;
      border-radius: 6px;
      font-size: 14px;
      color: #555;
    }
    .instructions ol {
      margin: 0;
      padding-left: 20px;
      line-height: 1.8;
    }
    .instructions li {
      margin-bottom: 8px;
    }
    .footer {
      background-color: #f9f7f4;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #888;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📬 Your Legacy Capsule Has Been Released</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${escapeHtml(data.contactName)},</div>
      <div class="message">
        A legacy capsule has been released to you by ${escapeHtml(data.userName)}. 
        This special message contains important information that the sender wanted you to know.
      </div>
      <div class="capsule-info">
        <div class="capsule-name">${escapeHtml(data.capsuleName)}</div>
      </div>
      <div class="notice">
        <div class="notice-title">🔐 Security Notice</div>
        <div class="notice-text">
          This link is single-use only and will expire after you access it. 
          The capsule content is encrypted and can only be opened with the passphrase provided below.
        </div>
      </div>
      <div class="instructions">
        <ol>
          <li>Click the button below to open the capsule</li>
          <li>You will be prompted to enter the passphrase</li>
          <li>Use the passphrase provided below to decrypt the contents</li>
          <li>Your access will be recorded for security purposes</li>
        </ol>
      </div>
      <div class="cta-section">
        <a href="${data.releaseUrl}" class="cta-button">Open Capsule</a>
      </div>
      <div class="passphrase-section">
        <div class="passphrase-label">🔑 Passphrase (keep this secure):</div>
        <div class="passphrase-value">${escapeHtml(data.passphrase)}</div>
        <div class="passphrase-warning">
          ⚠️ Treat this passphrase like a password. Do not share it with others.
        </div>
      </div>
      <div class="message" style="font-size: 13px; color: #888; margin-top: 32px;">
        If you have any questions or need assistance, please contact the sender directly.
      </div>
    </div>
    <div class="footer">
      <p>Legacy Switch — Secure Digital Legacy Management</p>
      <p>This is an automated notification email. Please do not reply to this address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your Legacy Capsule Has Been Released

Hello ${data.contactName},

A legacy capsule has been released to you by ${data.userName}. 
This special message contains important information that the sender wanted you to know.

Capsule: ${data.capsuleName}

🔐 SECURITY NOTICE
This link is single-use only and will expire after you access it. 
The capsule content is encrypted and can only be opened with the passphrase provided below.

HOW TO ACCESS:
1. Click the link below to open the capsule
2. You will be prompted to enter the passphrase
3. Use the passphrase provided below to decrypt the contents
4. Your access will be recorded for security purposes

OPEN CAPSULE:
${data.releaseUrl}

🔑 PASSPHRASE (keep this secure):
${data.passphrase}

⚠️ Treat this passphrase like a password. Do not share it with others.

---
Legacy Switch — Secure Digital Legacy Management
This is an automated notification email. Please do not reply to this address.
  `.trim();

  return { subject, html, text };
}

/**
 * Renders ACCESS_CONFIRMATION template
 * Subject: "Alert: Your Capsule '{capsuleName}' Was Accessed"
 */
function renderAccessConfirmation(data: AccessConfirmationData): RenderedEmail {
  const subject = `Alert: Your Capsule '${escapeHtml(data.capsuleName)}' Was Accessed`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset=UTF-8>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9f7f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555;
      margin-bottom: 24px;
    }
    .info-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-label {
      font-weight: 600;
      color: #333;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .info-value {
      color: #666;
      font-size: 14px;
    }
    .info-value strong {
      color: #333;
    }
    .footer {
      background-color: #f9f7f4;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #888;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Capsule Access Notification</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi ${escapeHtml(data.userName)},</div>
      <div class="message">
        One of your legacy capsules has been accessed and opened. 
        This notification confirms that your designated contact has successfully received and viewed your message.
      </div>
      <div class="info-box">
        <div class="info-label">📦 Capsule Name</div>
        <div class="info-value">${escapeHtml(data.capsuleName)}</div>
      </div>
      <div class="info-box">
        <div class="info-label">👤 Accessed By</div>
        <div class="info-value"><strong>${escapeHtml(data.contactName)}</strong> (${escapeHtml(data.contactEmail)})</div>
      </div>
      <div class="info-box">
        <div class="info-label">⏰ Access Time</div>
        <div class="info-value">${escapeHtml(data.accessedAt)}</div>
      </div>
      <div class="message" style="font-size: 13px; color: #888; margin-top: 32px;">
        This is an automated notification confirming that your legacy capsule has been accessed. 
        No further action is required on your part. Your capsule remains secure and cannot be accessed again 
        using the same link.
      </div>
    </div>
    <div class="footer">
      <p>Legacy Switch — Secure Digital Legacy Management</p>
      <p>This is an automated notification email. Please do not reply to this address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Capsule Access Notification

Hi ${data.userName},

One of your legacy capsules has been accessed and opened. 
This notification confirms that your designated contact has successfully received and viewed your message.

CAPSULE DETAILS
Name: ${data.capsuleName}
Accessed By: ${data.contactName} (${data.contactEmail})
Access Time: ${data.accessedAt}

This is an automated notification confirming that your legacy capsule has been accessed. 
No further action is required on your part. Your capsule remains secure and cannot be accessed again using the same link.

---
Legacy Switch — Secure Digital Legacy Management
This is an automated notification email. Please do not reply to this address.
  `.trim();

  return { subject, html, text };
}

/**
 * Utility function to escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
