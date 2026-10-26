import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { accountEmail } from "@/lib/account-email";

/**
 * "Forgot your password?" for customer accounts. The one-time token is minted
 * with the service role (generateLink, which sends nothing itself) and the
 * link points at this site's /account/reset-password, which verifies it
 * (verifyOtp with the token hash) and sets the new password. Returns false
 * when there is no such account or the email couldn't be sent; the form
 * ignores the result so it can't reveal who has an account.
 */
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
  const { html, text } = accountEmail({
    heading: "Reset your password",
    greetingName: ((data.user?.user_metadata?.name as string | undefined) ?? "").split(" ")[0],
    body: "someone (hopefully you) asked to reset the password for your account. Tap the button to choose a new one. If it wasn't you, you can ignore this email.",
    button: "Choose a new password",
    link,
    color: "#1d4ed8",
  });
  try {
    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Reset your password — ${businessName}`,
      html,
      text,
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
