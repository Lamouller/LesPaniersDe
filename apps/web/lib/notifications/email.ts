import nodemailer from 'nodemailer';

interface EmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  ok: boolean;
  error?: string;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(opts: EmailOpts): Promise<EmailResult> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('[email] SMTP not configured — skipping send');
    return { ok: false, error: 'smtp_not_configured' };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"LesPaniersDe" <noreply@lespaniersde.fr>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[email] send failed:', message);
    return { ok: false, error: message };
  }
}
