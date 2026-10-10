import { createServer, type Server } from "node:net";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { resetMailTransport, sendEmail } from "../mail";

// A minimal SMTP server (RFC 5321 happy path + AUTH PLAIN) that records what it receives.
let server: Server;
let port = 0;
const received: { auth?: string; from?: string; to: string[]; data: string }[] = [];

beforeAll(async () => {
  server = createServer((sock) => {
    const msg = { to: [] as string[], data: "", auth: undefined as string | undefined, from: undefined as string | undefined };
    let inData = false;
    let buf = "";
    sock.write("220 test ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString();
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(msg);
            sock.write("250 queued\r\n");
          } else msg.data += line + "\n";
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) sock.write("250-test\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) {
          msg.auth = Buffer.from(line.slice(11), "base64").toString();
          sock.write("235 ok\r\n");
        } else if (cmd.startsWith("MAIL FROM")) {
          msg.from = line.slice(10);
          sock.write("250 ok\r\n");
        } else if (cmd.startsWith("RCPT TO")) {
          msg.to.push(line.slice(8));
          sock.write("250 ok\r\n");
        } else if (cmd === "DATA") {
          inData = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") sock.end("221 bye\r\n");
        else sock.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));
afterEach(() => {
  vi.unstubAllEnvs();
  resetMailTransport();
});

it("delivers through SMTP_URL with authentication and the configured sender", async () => {
  vi.stubEnv("SMTP_URL", `smtp://ncc%40example.org:app-password@127.0.0.1:${port}?ignoreTLS=true`);
  vi.stubEnv("EMAIL_FROM", "No Competition Community <ncc@example.org>");
  await sendEmail({ to: "membro@example.org", subject: "Repor palavra-passe", text: "Abra https://app.example/reset-password?token=abc" });

  const m = received.at(-1)!;
  expect(m.auth).toBe("\0ncc@example.org\0app-password");
  expect(m.from).toContain("ncc@example.org");
  expect(m.to[0]).toContain("membro@example.org");
  expect(m.data).toContain("Subject: Repor palavra-passe");
  expect(m.data).toContain("reset-password?token=abc");
});

it("fails loudly without leaking credentials when the SMTP server is unreachable", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SMTP_URL", "smtp://user:super-secret@127.0.0.1:1?ignoreTLS=true&connectionTimeout=2000");
  await expect(sendEmail({ to: "a@example.org", subject: "x", text: "y" })).rejects.toThrow("Email delivery failed");
  expect(log.mock.calls.flat().join(" ")).not.toContain("super-secret");
});

it("refuses to silently drop email in production when nothing is configured", async () => {
  vi.stubEnv("SMTP_URL", undefined);
  vi.stubEnv("EMAIL_WEBHOOK_URL", undefined);
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(sendEmail({ to: "a@example.org", subject: "x", text: "y" })).rejects.toThrow("not configured");
});
