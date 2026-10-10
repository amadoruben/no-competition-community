import { describe, expect, it } from "vitest";
import { AUTH_TEMPLATES, buildAuthConfig, describePatch, parseFrom, parseSmtpUrl } from "../supabase-auth-config";

describe("Supabase Auth config (Management API patch)", () => {
  const env = {
    SMTP_URL: "smtps://resend:re_secret%2Fvalue@smtp.resend.com:465",
    EMAIL_FROM: "No Competition Community <no-reply@auth.ncc.example>",
    APP_URL: "https://ncc.example/some/path",
    AUTH_REDIRECT_URLS: "https://preview.example.vercel.app/**, https://ncc.example/**",
    AUTH_EMAIL_RATE_LIMIT: "100",
  };

  it("maps the app's SMTP_URL / EMAIL_FROM to Supabase's SMTP fields", () => {
    const { patch, problems } = buildAuthConfig(env);
    expect(problems).toEqual([]);
    expect(patch).toMatchObject({
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "re_secret/value",
      smtp_admin_email: "no-reply@auth.ncc.example",
      smtp_sender_name: "No Competition Community",
      site_url: "https://ncc.example",
      uri_allow_list: "https://ncc.example/**,https://preview.example.vercel.app/**",
      rate_limit_email_sent: 100,
      mailer_autoconfirm: false,
    });
  });

  it("uses token_hash links (any device) that land on the app's own routes", () => {
    expect(AUTH_TEMPLATES.mailer_templates_confirmation_content).toContain("{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email");
    expect(AUTH_TEMPLATES.mailer_templates_recovery_content).toContain("{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery");
    expect(buildAuthConfig(env, { templates: false }).patch).not.toHaveProperty("mailer_templates_confirmation_content");
  });

  it("never shows the SMTP password", () => {
    const lines = describePatch(buildAuthConfig(env).patch).join("\n");
    expect(lines).not.toContain("re_secret");
    expect(lines).toContain("smtp_pass = ••••••");
  });

  it("explains what is missing or wrong, without echoing values", () => {
    const { problems } = buildAuthConfig({ SMTP_URL: "https://x", EMAIL_FROM: "nope", APP_URL: "http://ncc.example", AUTH_EMAIL_RATE_LIMIT: "-1" });
    expect(problems.join("\n")).toMatch(/SMTP_URL[\s\S]*EMAIL_FROM[\s\S]*APP_URL: must be https[\s\S]*AUTH_EMAIL_RATE_LIMIT/);
  });

  it("parses sender and SMTP URL forms", () => {
    expect(parseFrom("no-reply@x.pt")).toEqual({ email: "no-reply@x.pt" });
    expect(parseFrom('"NCC" <a@b.pt>')).toEqual({ name: "NCC", email: "a@b.pt" });
    expect(parseSmtpUrl("smtp://u:p@h.example")).toEqual({ host: "h.example", port: 587, user: "u", pass: "p" });
    expect(parseSmtpUrl("smtp://h.example:587")).toBeNull(); // no credentials
  });
});
