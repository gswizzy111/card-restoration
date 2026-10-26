import { createClient } from "@/lib/supabase/server";
import { CONFIRM_SUBJECT, sendConfirmLink } from "@/lib/account-confirm";
import { fromAddress } from "@/lib/resend";
import { z } from "zod";

const SENT = "Please confirm your email first. We just sent you a new confirmation link.";
const NOT_SENT = "Please confirm your email first. We couldn't send a new link just now. Please try again in a minute.";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// An unconfirmed account gets a new confirm link when its password is right
// (which is also what the "Send it again" button on the sign-in page does).
// It only says a link was sent when the email actually went out.
async function notConfirmed(email: string) {
  const sent = await sendConfirmLink(email);
  return Response.json(
    { error: sent ? SENT : NOT_SENT, code: "EMAIL_NOT_CONFIRMED", confirmationSent: sent, sentFrom: fromAddress, subject: CONFIRM_SUBJECT },
    { status: 403 }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    if (/not confirmed/i.test(error.message)) return notConfirmed(email);
    if (error.status === 429) {
      return Response.json({ error: "Too many attempts. Please wait a minute and try again.", code: "RATE_LIMITED" }, { status: 429 });
    }
    const wrongPassword = error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message);
    return Response.json({ error: error.message, ...(wrongPassword ? { code: "INVALID_CREDENTIALS" } : {}) }, { status: 400 });
  }

  // Accounts are tied to orders by email: an unconfirmed address gets no access
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    return notConfirmed(email);
  }
  return Response.json({ ok: true });
}
