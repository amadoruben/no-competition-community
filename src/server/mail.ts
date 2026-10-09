import { createTransport, type Transporter } from "nodemailer";
import { logger } from "./logger";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outgoing email sent by the application itself (the local auth provider's
 * password resets). With Supabase Auth, account emails are sent by Supabase
 * through the SMTP server configured in its dashboard, not by this module.
 *
 * Transports, first match wins:
 *   SMTP_URL           smtps://user:password@host:465 (or smtp://…:587 with STARTTLS) — any provider
 *   EMAIL_WEBHOOK_URL  POST {to, subject, text} as JSON, for HTTP-only providers
 *   neither            development prints the message; production refuses
 */
let smtp: Transporter | undefined;

export async function sendEmail(email: Email) {
  const smtpUrl = process.env.SMTP_URL;
  if (smtpUrl) {
    smtp ??= createTransport(smtpUrl, { from: process.env.EMAIL_FROM });
    try {
      await smtp.sendMail({ to: email.to, subject: email.subject, text: email.text });
    } catch (error) {
      // Credentials are part of SMTP_URL: log the provider's answer, never the URL.
      logger.error("mail.smtp_failed", { subject: email.subject, code: (error as { code?: string }).code, response: (error as { response?: string }).response });
      throw new Error("Email delivery failed");
    }
    return;
  }

  const endpoint = process.env.EMAIL_WEBHOOK_URL;
  if (endpoint) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN ?? ""}` },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    logger.error("mail.not_configured", { subject: email.subject });
    throw new Error("Email is not configured");
  }
  // Development: the link is printed so the flow can be completed locally.
  console.log(`\n[email to ${email.to}] ${email.subject}\n${email.text}\n`);
}

/** For tests: drop the cached transport so a new SMTP_URL takes effect. */
export function resetMailTransport() {
  smtp?.close();
  smtp = undefined;
}
