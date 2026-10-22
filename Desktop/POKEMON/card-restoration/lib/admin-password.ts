import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/crypto";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { escapeHtml } from "@/lib/card-inquiries";
import { endSessionsFor, newToken, sha256, TOKEN_PATTERN } from "@/lib/admin-session";

/**
 * Admin and accountant passwords: change (from the admin profile) and
 * "forgot password" links. A reset link holds a random token; the database
 * keeps only its SHA-256 (admin_password_resets). It works once, for an hour,
 * and using it signs that person out everywhere. Admins get the link at the
 * recovery email on their profile; accountants at their sign-in email.
 */
export const ADMIN_PASSWORD_MIN = 10;
const RESET_MINUTES = 60;
// One email per person per couple of minutes, so the form can't flood an inbox
const RESEND_GAP_MS = 2 * 60_000;

export type PasswordOwner = { adminUserId: string } | { accountantId: string };

export function passwordProblem(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN) return `Use at least ${ADMIN_PASSWORD_MIN} characters.`;
  if (password.length > 200) return "That password is too long.";
  return null;
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
}

/** A short admin email: heading, a paragraph, and an optional button. */
export async function sendAdminEmail(
  to: string,
  subject: string,
  heading: string,
  body: string,
  button?: { label: string; href: string },
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h1 style="font-size:22px;font-weight:900;margin:0 0 12px">${escapeHtml(heading)}</h1>
          <p style="font-size:15px;line-height:1.6;color:#333">${body}</p>
          ${button ? `<a href="${button.href}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:12px 0">${escapeHtml(button.label)}</a>
          <p style="font-size:12px;color:#888;line-height:1.5">This link works once and expires in 1 hour. Didn't ask for this? Ignore this email; your password stays the same.</p>` : ""}
          <p style="font-size:13px;color:#666">${escapeHtml(businessName)}</p>
        </div>
      `,
    });
    if (error) {
      console.error("Admin email failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Admin email failed:", err);
    return false;
  }
}

/**
 * "Forgot password": emails a reset link to whoever `login` names (an admin
 * username, an admin's recovery email, or an accountant's email). Sends
 * nothing when there's no such account or no email on file; the caller
 * answers the same either way.
 */
export async function startPasswordReset(login: string) {
  const value = login.trim().toLowerCase();
  if (!value) return;
  const admin = createAdminClient();
  const targets: { owner: PasswordOwner; email: string; name: string }[] = [];

  const { data: adminUser } = await admin
    .from("admin_users")
    .select("id, username, email")
    .eq(value.includes("@") ? "email" : "username", value)
    .eq("active", true)
    .maybeSingle();
  if (adminUser?.email) targets.push({ owner: { adminUserId: adminUser.id }, email: adminUser.email, name: adminUser.username });

  if (value.includes("@")) {
    // Only accountants who have set a password (and still have access)
    const { data: accountant } = await admin
      .from("accountant_access")
      .select("id, email")
      .eq("email", value)
      .not("password_hash", "is", null)
      .maybeSingle();
    if (accountant) targets.push({ owner: { accountantId: accountant.id }, email: accountant.email, name: accountant.email });
  }

  // Used links and links past their hour are no use to anyone
  await admin.from("admin_password_resets").delete().or(`used_at.not.is.null,expires_at.lt."${new Date().toISOString()}"`);

  for (const t of targets) {
    const column = "adminUserId" in t.owner ? "admin_user_id" : "accountant_id";
    const ownerId = "adminUserId" in t.owner ? t.owner.adminUserId : t.owner.accountantId;
    const { data: recent } = await admin
      .from("admin_password_resets")
      .select("created_at")
      .eq(column, ownerId)
      .gt("created_at", new Date(Date.now() - RESEND_GAP_MS).toISOString())
      .limit(1);
    if (recent?.length) continue;

    const token = newToken();
    const { error } = await admin.from("admin_password_resets").insert({
      token_hash: await sha256(token),
      [column]: ownerId,
      expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
    });
    if (error) {
      console.error("Could not start password reset:", error.message);
      continue;
    }
    const isAdmin = "adminUserId" in t.owner;
    await sendAdminEmail(
      t.email,
      `${businessName}: reset your ${isAdmin ? "admin" : "accountant"} password`,
      "Reset your password",
      `Someone (hopefully you) asked to reset the password for the ${isAdmin ? "admin login" : "accountant login"} <strong>${escapeHtml(t.name)}</strong>. Tap the button to choose a new one.`,
      { label: "Choose a new password", href: `${appUrl()}/admin/reset-password?token=${token}` },
    );
  }
}

/**
 * The reset link's form: uses up the token, sets the new password, and signs
 * that person out everywhere. Returns an error message, or null when done.
 */
export async function finishPasswordReset(token: string, password: string): Promise<string | null> {
  const problem = passwordProblem(password);
  if (problem) return problem;
  const expired = "This reset link has expired or was already used. Request a new one.";
  if (!TOKEN_PATTERN.test(token)) return expired;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  // Marking it used in the same statement that finds it, so a link can't be used twice
  const { data: reset } = await admin
    .from("admin_password_resets")
    .update({ used_at: now })
    .eq("token_hash", await sha256(token))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("admin_user_id, accountant_id")
    .maybeSingle();
  if (!reset) return expired;

  const password_hash = await hashPassword(password);
  if (reset.admin_user_id) {
    const { data: updated } = await admin
      .from("admin_users")
      .update({ password_hash })
      .eq("id", reset.admin_user_id)
      .eq("active", true)
      .select("id");
    if (!updated?.length) return expired;
    await endSessionsFor({ adminUserId: reset.admin_user_id });
    await admin.from("admin_password_resets").delete().eq("admin_user_id", reset.admin_user_id);
  } else if (reset.accountant_id) {
    const { data: updated } = await admin
      .from("accountant_access")
      .update({ password_hash })
      .eq("id", reset.accountant_id)
      .not("password_hash", "is", null)
      .select("id");
    if (!updated?.length) return expired;
    await endSessionsFor({ accountantId: reset.accountant_id });
    await admin.from("admin_password_resets").delete().eq("accountant_id", reset.accountant_id);
  } else {
    return expired;
  }
  return null;
}
