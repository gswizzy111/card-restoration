import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmLink } from "@/lib/account-confirm";
import { z } from "zod";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

// Creates the account unconfirmed and emails a confirm link. Orders are matched
// to accounts by email, so nobody can see orders until they prove they own it.
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

  if (createError) {
    const exists = /already|exists|registered/i.test(createError.message);
    if (!exists) return Response.json({ error: createError.message }, { status: 400 });
    // Already signed up: a confirmed account signs in; an unconfirmed one gets a new link
    const { data: existing } = await adminSupabase.auth.admin.generateLink({ type: "magiclink", email });
    if (existing?.user?.email_confirmed_at) {
      return Response.json({ error: "An account with that email already exists. Please sign in instead." }, { status: 400 });
    }
  }

  const sent = await sendConfirmLink(email, name);
  if (!sent) return Response.json({ error: "We couldn't send the confirmation email. Please try again." }, { status: 500 });
  return Response.json({ ok: true, confirmationSent: true });
}
