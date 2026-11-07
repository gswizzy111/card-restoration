import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/crypto";
import { sha256, TOKEN_PATTERN } from "@/lib/admin-session";
import { passwordProblem } from "@/lib/admin-password";

// The support invite link's form (/support/setup): sets the member's password
// and uses up the link.
const Body = z.object({ token: z.string(), password: z.string().max(200) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { token, password } = parsed.data;
  const problem = passwordProblem(password);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const invalid = "This invite link has expired or was already used. Ask an admin to resend it.";
  if (!TOKEN_PATTERN.test(token)) return Response.json({ error: invalid }, { status: 400 });

  const admin = createAdminClient();
  // Finding and using up the link in one statement, so it can't be used twice
  const { data: member } = await admin
    .from("support_access")
    .update({ password_hash: await hashPassword(password), invite_token: null, invite_token_expires_at: null })
    .eq("invite_token", await sha256(token))
    .gt("invite_token_expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (!member) return Response.json({ error: invalid }, { status: 400 });
  return Response.json({ ok: true });
}
