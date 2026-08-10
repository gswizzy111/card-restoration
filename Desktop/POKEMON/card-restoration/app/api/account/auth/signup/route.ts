import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return Response.json({ error: msg }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  // Use service-role client to create a pre-confirmed user (no email verification step)
  const adminSupabase = createAdminClient();
  const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError) {
    // Surface duplicate-email error clearly
    const msg = createError.message.includes("already") || createError.message.includes("exists")
      ? "An account with that email already exists. Please sign in instead."
      : createError.message;
    return Response.json({ error: msg }, { status: 400 });
  }

  // Sign the user in immediately so the session cookie is set
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return Response.json({ error: signInError.message }, { status: 400 });

  return Response.json({ ok: true, userId: created.user?.id });
}
