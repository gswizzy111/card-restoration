import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  token_hash: z.string().min(10),
  // Supabase refuses passwords over 72 characters: catch that before the link is used up
  password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password must be at most 72 characters."),
});

// The reset link's form: verifies the one-time token (which signs the customer
// in), then sets the new password.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: parsed.data.token_hash });
  if (verifyError) {
    return Response.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }
  const user = verified.user;
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // The link confirmed the email. If the account was signed up more than
    // once, someone else may know its old password: lock it out, so the
    // refusal never leaves that password working.
    if (user?.app_metadata?.signup_conflict) {
      const random = randomBytes(32).toString("base64url") + "aA1!";
      const { error: lockError } = await supabase.auth.updateUser({ password: random });
      if (lockError) {
        const { error: adminError } = await createAdminClient().auth.admin.updateUserById(user.id, { password: random });
        if (adminError) console.error("Locking out a contested password failed:", adminError.message);
      }
      await supabase.auth.signOut();
    }
    const message = error.code === "weak_password"
      ? "That password is too easy to guess. Please choose a longer or less common one."
      : error.code === "same_password"
        ? "Please choose a password you haven't used for this account."
        : error.message;
    // The page offers "Request a new link" when the message says the link was used
    return Response.json({ error: `${message} This link has now been used, so request a new one.` }, { status: 400 });
  }
  // Anyone else signed in to this account is signed out
  await supabase.auth.signOut({ scope: "others" });
  // The owner of the inbox chose this password, so a contested sign-up is settled
  if (user?.app_metadata?.signup_conflict) {
    const { error: clearError } = await createAdminClient().auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, signup_conflict: false },
    });
    if (clearError) console.error("Clearing signup_conflict failed:", clearError.message);
  }
  return Response.json({ ok: true });
}
