import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const Body = z.object({
  token_hash: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

// The reset link's form: verifies the one-time token (which signs the customer
// in), then sets the new password.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: parsed.data.token_hash });
  if (verifyError) {
    return Response.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  // Anyone else signed in to this account is signed out
  await supabase.auth.signOut({ scope: "others" });
  return Response.json({ ok: true });
}
