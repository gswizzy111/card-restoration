import { createAdminClient } from "@/lib/supabase/admin";
import { CONFIRM_SUBJECT, emailConfirmLink, mintConfirmToken, passwordMatches } from "@/lib/account-confirm";
import { fromAddress } from "@/lib/resend";
import { z } from "zod";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

// Creates the account unconfirmed and emails a confirm link. Orders are matched
// to accounts by email, so nobody can see orders until they prove they own it.
// The reply says who the email comes from, so the page can tell people what to
// look for (and to check Spam).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return Response.json({ error: msg }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password, name } = parsed.data;
  const adminSupabase = createAdminClient();

  const { error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { name },
  });

  let existingAccount = false;
  if (createError) {
    const exists = /already|exists|registered/i.test(createError.message);
    if (!exists) return Response.json({ error: createError.message }, { status: 400 });
    existingAccount = true;
  }

  // One token per request: minting another would cancel the link we email.
  const minted = await mintConfirmToken(email);
  if (!minted) return Response.json({ error: "We couldn't send the confirmation email. Please try again." }, { status: 500 });
  // Already signed up and confirmed: sign in instead.
  if (minted.user.email_confirmed_at) {
    return Response.json({ error: "An account with that email already exists. Please sign in instead." }, { status: 400 });
  }
  // Signed up before but never confirmed. The password stays the one chosen
  // first. If this sign-up used a different password, someone else may know
  // the first one (anyone can type any email), so the account is flagged and
  // its confirm links ask for the account's password, or a new one, before
  // confirming. Checked before sending, and nothing is sent if flagging fails.
  let check = !!minted.user.app_metadata?.signup_conflict;
  if (existingAccount && !check && !(await passwordMatches(email, password))) {
    const { error: flagError } = await adminSupabase.auth.admin.updateUserById(minted.user.id, {
      app_metadata: { ...minted.user.app_metadata, signup_conflict: true },
    });
    if (flagError) {
      console.error("Flagging a repeat sign-up failed:", flagError.message);
      return Response.json({ error: "We couldn't send the confirmation email. Please try again." }, { status: 500 });
    }
    check = true;
  }

  const greet = existingAccount ? (minted.user.user_metadata?.name as string | undefined) : name;
  const sent = await emailConfirmLink(email, minted.tokenHash, greet, check);
  if (!sent) return Response.json({ error: "We couldn't send the confirmation email. Please try again." }, { status: 500 });
  return Response.json({ ok: true, confirmationSent: true, sentFrom: fromAddress, subject: CONFIRM_SUBJECT });
}
