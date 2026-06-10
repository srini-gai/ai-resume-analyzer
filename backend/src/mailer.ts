import nodemailer from "nodemailer";

function isConfigured(): boolean {
  return !!(process.env.MAIL_USER && process.env.MAIL_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

const adminEmail = process.env.MAIL_USER ?? "srinivk2013@gmail.com";

// ─── Admin notification email ─────────────────────────────────────────────────

function adminEmailHtml(user: { email: string; name: string | null; id: string }): string {
  const name = user.name ?? "Unknown";
  const joined = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#07091a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#07091a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0d1020;border-radius:16px;border:1px solid #1e2240;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            ✦ ResumeIQ
          </p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Access request notification</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#e2e8f0;">
            New access request
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
            A new user has requested access to ResumeIQ and is waiting for your approval.
          </p>

          <!-- User card -->
          <table width="100%" style="background:#151929;border-radius:12px;border:1px solid #1e2240;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%">
                ${[
                  ["Name",    name],
                  ["Email",   user.email],
                  ["Joined",  joined],
                  ["Status",  "⏳ Pending approval"],
                ].map(([label, value]) => `
                <tr>
                  <td style="padding:6px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;width:72px;">${label}</td>
                  <td style="padding:6px 0;font-size:14px;color:#e2e8f0;font-weight:500;">${value}</td>
                </tr>`).join("")}
              </table>
            </td></tr>
          </table>

          <!-- CTA button -->
          <table width="100%"><tr><td align="center">
            <a href="https://resumeanalyzer.pro/admin"
               style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.01em;">
              Approve Access →
            </a>
          </td></tr></table>

          <p style="margin:20px 0 0;font-size:12px;color:#475569;text-align:center;">
            Or ignore this email if you don't want to approve this request.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #1e2240;">
          <p style="margin:0;font-size:11px;color:#334155;text-align:center;">
            ResumeIQ · AI-powered career intelligence · Built by Srini
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── User confirmation email ──────────────────────────────────────────────────

function userEmailHtml(user: { email: string; name: string | null }): string {
  const firstName = user.name?.split(" ")[0] ?? "there";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#07091a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#07091a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0d1020;border-radius:16px;border:1px solid #1e2240;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#fff;">✦ ResumeIQ</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">AI-powered career intelligence</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#e2e8f0;">
            You're on the list, ${firstName}! 🎉
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
            Thanks for signing up! ResumeIQ is currently <strong style="color:#e2e8f0;">invite-only</strong> while we're in early access.
            Srini will review your request and grant you access shortly.
          </p>

          <!-- Steps -->
          <table width="100%" style="margin-bottom:28px;">
            ${[
              ["✅", "Request submitted",   "We've received your access request."],
              ["⏳", "Under review",        "Srini will review within 24 hours."],
              ["🚀", "Get access",          "You'll receive an email when approved."],
            ].map(([icon, title, desc]) => `
            <tr>
              <td style="width:40px;padding:8px 0;vertical-align:top;font-size:18px;">${icon}</td>
              <td style="padding:8px 0 8px 8px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#e2e8f0;">${title}</p>
                <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${desc}</p>
              </td>
            </tr>`).join("")}
          </table>

          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
            We'll send your approval notification to
            <span style="color:#818cf8;font-weight:600;">${user.email}</span>.
            Keep an eye on your inbox!
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #1e2240;">
          <p style="margin:0;font-size:11px;color:#334155;text-align:center;">
            ResumeIQ · resumeanalyzer.pro · Built with ♥ by Srini, Bangalore
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendWaitlistNotification(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  if (!isConfigured()) {
    console.warn("MAIL_USER/MAIL_PASS not set — skipping waitlist email notification");
    return;
  }

  const transport = createTransport();

  await Promise.all([
    transport.sendMail({
      from: `ResumeIQ <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: `🔔 New ResumeIQ Access Request — ${user.name ?? user.email}`,
      html: adminEmailHtml(user),
    }),
    transport.sendMail({
      from: `ResumeIQ <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: "You're on the ResumeIQ waitlist!",
      html: userEmailHtml(user),
    }),
  ]);
}
