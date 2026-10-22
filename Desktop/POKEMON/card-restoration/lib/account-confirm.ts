import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

/**
 * New accounts confirm their email before they can sign in: orders are linked
 * to accounts by email, so an unconfirmed address must not see any. The
 * confirm page lives on the new site (theonethatsaveditall.com), which shares
 * this site's accounts; pressing its button confirms and signs them in.
 * Returns false when the email couldn't be sent.
 */
const CONFIRM_URL = "https://theonethatsaveditall.com/account/confirm";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendConfirmLink(email: string, name?: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    if (error) console.error("generateLink (confirm) failed:", error.message);
    return false;
  }
  const link = `${CONFIRM_URL}?token_hash=${encodeURIComponent(tokenHash)}`;
  const first = (name ?? (data.user?.user_metadata?.name as string | undefined) ?? "").split(" ")[0];
  try {
    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Confirm your email — ${businessName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h1 style="font-size:22px;font-weight:900;margin:0 0 12px">Confirm your email</h1>
          <p style="font-size:15px;line-height:1.6;color:#333">${first ? `Hi ${esc(first)}, ` : ""}tap the button to confirm your email and open your account. Your orders placed with this email will show up there.</p>
          <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:12px 0">Confirm my email</a>
          <p style="font-size:12px;color:#888;line-height:1.5">This link works once and expires in 1 hour. Didn't ask for this? Ignore this email.</p>
        </div>
      `,
    });
    if (sendError) {
      console.error("Confirm email failed:", sendError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Confirm email failed:", err);
    return false;
  }
}
