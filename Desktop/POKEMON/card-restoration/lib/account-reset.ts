import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

/**
 * "Forgot your password?" for customer accounts. The one-time token is minted
 * with the service role (generateLink, which sends nothing itself) and the
 * link points at this site's /account/reset-password, which verifies it
 * (verifyOtp with the token hash) and sets the new password. Returns false
 * when there is no such account or the email couldn't be sent; the form
 * ignores the result so it can't reveal who has an account.
 */
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendResetLink(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    if (error) console.error("generateLink (reset) failed:", error.message);
    return false;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const link = `${appUrl}/account/reset-password?token_hash=${encodeURIComponent(tokenHash)}`;
  const first = ((data.user?.user_metadata?.name as string | undefined) ?? "").split(" ")[0];
  try {
    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Reset your password — ${businessName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h1 style="font-size:22px;font-weight:900;margin:0 0 12px">Reset your password</h1>
          <p style="font-size:15px;line-height:1.6;color:#333">${first ? `Hi ${esc(first)}, ` : ""}someone (hopefully you) asked to reset the password for your account. Tap the button to choose a new one. If it wasn't you, you can ignore this email.</p>
          <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:12px 0">Choose a new password</a>
          <p style="font-size:12px;color:#888;line-height:1.5">This link works once and expires in 1 hour. Didn't ask for this? Ignore this email.</p>
        </div>
      `,
    });
    if (sendError) {
      console.error("Reset email failed:", sendError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Reset email failed:", err);
    return false;
  }
}
