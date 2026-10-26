import { createClient as createSupabase, type User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { accountEmail } from "@/lib/account-email";

/**
 * New accounts confirm their email before they can sign in: orders are linked
 * to accounts by email, so an unconfirmed address must not see any. The
 * confirm page lives on the new site (theonethatsaveditall.com), which shares
 * this site's accounts; pressing its button confirms and signs them in.
 */
const CONFIRM_URL = "https://theonethatsaveditall.com/account/confirm";

export const CONFIRM_SUBJECT = `Confirm your email — ${businessName}`;

/**
 * A fresh one-time confirm token for the account with this email (minting one
 * cancels the link in any earlier email). Null when there is no such account.
 */
export async function mintConfirmToken(email: string): Promise<{ tokenHash: string; user: User } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash || !data.user) {
    if (error) console.error("generateLink (confirm) failed:", error.message);
    return null;
  }
  return { tokenHash, user: data.user };
}

/**
 * Whether `password` is this unconfirmed account's password, checked on a
 * throwaway client so no session is kept: Supabase answers "Email not
 * confirmed" only when the password is right. "error" when Supabase couldn't
 * say (rate limit, outage): callers must not treat that as either answer.
 */
export async function checkPassword(email: string, password: string): Promise<"match" | "mismatch" | "error"> {
  const check = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await check.auth.signInWithPassword({ email, password });
  if (!error) {
    if (data.session) await check.auth.signOut({ scope: "local" });
    return "match";
  }
  if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) return "match";
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) return "mismatch";
  console.error("Password check failed:", error.message);
  return "error";
}

/**
 * Emails the confirm link for a token from mintConfirmToken. False when the
 * send failed. `checkUserId`: the account was signed up more than once with
 * different passwords, so the link carries its id and check=1, and the
 * confirm page (on the new site) asks for its password, or a new one, before
 * confirming. (The id, not the email, so no address ends up in the link.)
 */
export async function emailConfirmLink(email: string, tokenHash: string, name?: string | null, checkUserId?: string): Promise<boolean> {
  const params = new URLSearchParams({ token_hash: tokenHash });
  if (checkUserId) {
    params.set("uid", checkUserId);
    params.set("check", "1");
  }
  const link = `${CONFIRM_URL}?${params.toString()}`;
  const { html, text } = accountEmail({
    heading: "Confirm your email",
    greetingName: name ?? "",
    body: "tap the button to confirm your email and open your account. Your orders placed with this email will show up there.",
    button: "Confirm my email",
    link,
    color: "#1d4ed8",
  });
  try {
    const { error: sendError } = await resend.emails.send({ from: fromEmail, to: email, subject: CONFIRM_SUBJECT, html, text });
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

/** Mints a new confirm link and emails it. Returns false when the email couldn't be sent. */
export async function sendConfirmLink(email: string, name?: string | null): Promise<boolean> {
  const minted = await mintConfirmToken(email);
  if (!minted) return false;
  const checkUserId = minted.user.app_metadata?.signup_conflict ? minted.user.id : undefined;
  return emailConfirmLink(email, minted.tokenHash, name ?? (minted.user.user_metadata?.name as string | undefined), checkUserId);
}
