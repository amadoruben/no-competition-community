import { logger } from "./logger";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outgoing email for the local auth provider. Without an SMTP/API provider
 * configured the message is logged (development only). With Supabase Auth,
 * account emails are sent by Supabase and this is not used.
 *
 * To add a provider, implement the POST below for its HTTP API.
 */
export async function sendEmail(email: Email) {
  const endpoint = process.env.EMAIL_WEBHOOK_URL;
  if (!endpoint) {
    if (process.env.NODE_ENV === "production") {
      logger.error("mail.not_configured", { subject: email.subject });
      throw new Error("Email is not configured");
    }
    // Development: the link is printed so the flow can be completed locally.
    console.log(`\n[email to ${email.to}] ${email.subject}\n${email.text}\n`);
    return;
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN ?? ""}` },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
}
