import { Resend } from 'resend';

type MailerConfig = {
  resendApiKey: string | null;
  emailFrom: string;
  emailFromName: string;
  contactEmail: string;
};

type ResendClient = Pick<Resend, 'emails'>;

/**
 * Mailer Service — owns the Resend API client and all email templates.
 *
 * Built as a factory so the transport config is injected rather than read
 * from process.env directly. This makes it mockable in tests and reusable
 * across different environment configs without any module-level side effects.
 *
 * The optional client injection keeps delivery tests fully offline.
 */
export function createMailerService(config: MailerConfig, client?: ResendClient) {
  if (!config.resendApiKey && !client) throw new Error('RESEND_API_KEY is not configured');
  const resend = client ?? new Resend(config.resendApiKey!);
  const from = `${config.emailFromName} <${config.emailFrom}>`;

  async function deliver(payload: Parameters<ResendClient['emails']['send']>[0]) {
    const { data, error } = await resend.emails.send(payload);
    if (error) throw new Error(`Resend delivery failed: ${error.message}`);
    return data;
  }

  // ── Public methods ───────────────────────────────────────────────────────

  /**
   * Send an OTP verification email.
   * plainOtp is the raw code — it must already have been generated before
   * this is called. Never passes through the hash.
   */
  async function sendOtpEmail({ to, otp }: { to: string; otp: string }) {
    return deliver({
      from,
      to,
      subject: 'Your verification code',
      text:    buildOtpText(otp),
      html:    buildOtpHtml(otp),
    });
  }

  /**
   * Send a welcome email after successful OTP verification.
   * Fire-and-forget safe — the caller should not await this on the critical path.
   */
  async function sendWelcomeEmail({ to, username }: { to: string; username: string }) {
    return deliver({
      from,
      to,
      subject: 'Welcome — your account is ready',
      text:    buildWelcomeText(username),
      html:    buildWelcomeHtml(username),
    });
  }

  async function sendPasswordResetEmail({ to, otp }: { to: string; otp: string }) {
    return deliver({
      from,
      to,
      subject: 'Your password reset code',
      text:    buildPasswordResetText(otp),
      html:    buildPasswordResetHtml(otp),
    });
  }

  async function sendContactEmail({ name, email, message }: { name: string; email: string; message: string }) {
    const safeName = name.replace(/[\r\n]+/g, ' ').trim();
    return deliver({
      from,
      to:      config.contactEmail,
      replyTo: email,
      subject: `Contact form: ${safeName}`,
      text:    `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html:    buildContactHtml({ name, email, message }),
    });
  }

  return { sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail, sendContactEmail };
}

// ── Email templates ──────────────────────────────────────────────────────────
// Plain-text versions exist alongside HTML so email clients that block images
// or scripts still get a readable message.

const OTP_EXPIRY_MINUTES = 15;

function buildOtpText(otp) {
  return [
    `Your verification code is: ${otp}`,
    '',
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
}

function buildOtpHtml(otp) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Verification Code</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:8px;overflow:hidden;
                          box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <tr>
                <td style="background:#111827;padding:24px 32px;">
                  <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                    Verify your account
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                    Use the code below to verify your account.
                    It expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
                  </p>
                  <div style="text-align:center;margin:24px 0;">
                    <span style="display:inline-block;background:#f3f4f6;border:2px dashed #d1d5db;
                                 border-radius:6px;padding:16px 32px;font-size:32px;font-weight:800;
                                 letter-spacing:8px;color:#111827;font-family:monospace;">
                      ${otp}
                    </span>
                  </div>
                  <p style="margin:0;color:#6b7280;font-size:13px;">
                    If you did not request this code, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim();
}

function buildPasswordResetText(otp) {
  return [
    `Your password reset code is: ${otp}`,
    '',
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
}

function buildPasswordResetHtml(otp) {
  return buildOtpHtml(otp).replace('Verify your account', 'Reset your password').replace('Use the code below to verify your account.', 'Use the code below to reset your password.');
}

function buildWelcomeText(username) {
  return [
    `Welcome, ${username}!`,
    '',
    'Your account has been verified and is ready to use.',
  ].join('\n');
}

function buildContactHtml({ name, email, message }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const escaped = escapeHtml(message).replace(/\n/g, '<br/>');
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:40px;background:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:#111827;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">New Contact Form Submission</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#374151;"><strong>Name:</strong> ${safeName}</p>
          <p style="margin:0 0 16px;color:#374151;"><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          <p style="margin:0 0 8px;color:#374151;font-weight:700;">Message:</p>
          <p style="margin:0;color:#374151;line-height:1.6;">${escaped}</p>
        </td></tr>
      </table>
    </body></html>
  `.trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function buildWelcomeHtml(username) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:8px;overflow:hidden;
                          box-shadow:0 2px 8px rgba(0,0,0,.08);">
              <tr>
                <td style="background:#111827;padding:24px 32px;">
                  <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                    Welcome aboard
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
                    Hi <strong>${username}</strong>,
                  </p>
                  <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
                    Your account has been verified and is ready to use.
                    Welcome to the platform!
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim();
}
