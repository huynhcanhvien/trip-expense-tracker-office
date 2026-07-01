// Email sender adapter — plan §1. Switches on EMAIL_ADAPTER:
//   console (default, dev fallback — logs the message + any links to the terminal)
//   mailpit (SMTP localhost:1025 via nodemailer; T6)
//   resend  (prod; wired in T20)
import nodemailer from "nodemailer";

type EmailAdapter = "console" | "mailpit" | "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function adapter(): EmailAdapter {
  return (process.env.EMAIL_ADAPTER as EmailAdapter) || "console";
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Trip Splitter <noreply@petal.local>";
}

/** Send an email through the configured adapter. */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  switch (adapter()) {
    case "mailpit":
      return sendViaMailpit(msg);
    case "resend":
      // Implemented in T20.
      throw new Error("EMAIL_ADAPTER=resend is not configured yet (T20)");
    case "console":
    default:
      return sendViaConsole(msg);
  }
}

async function sendViaConsole(msg: EmailMessage): Promise<void> {
  const links = extractLinks(msg.html);
  console.log(
    [
      "",
      "📧 ───────────────  EMAIL (console adapter)  ───────────────",
      `   To:      ${msg.to}`,
      `   From:    ${fromAddress()}`,
      `   Subject: ${msg.subject}`,
      ...(links.length ? ["   Links:", ...links.map((l) => `     → ${l}`)] : []),
      "───────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

async function sendViaMailpit(msg: EmailMessage): Promise<void> {
  const transport = nodemailer.createTransport({
    host: process.env.MAILPIT_HOST || "localhost",
    port: Number(process.env.MAILPIT_PORT || 1025),
    secure: false,
  });
  await transport.sendMail({
    from: fromAddress(),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

/** Pull href/URL targets out of the HTML so the console adapter can show them. */
function extractLinks(html: string): string[] {
  const out = new Set<string>();
  const re = /https?:\/\/[^\s"'<>]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[0]);
  return [...out];
}
