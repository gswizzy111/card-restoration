import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/crypto";
import { sha256, TOKEN_PATTERN } from "@/lib/admin-session";
import { CREATOR_PASSWORD_MIN, createCreatorSession } from "@/lib/creator-portal";

const Body = z.object({ token: z.string().max(100), password: z.string().max(200) });

// The setup link's form: the creator chooses their password and is signed
// in. The link works once; using it signs out any other sign-ins.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { token, password } = parsed.data;
  if (password.length < CREATOR_PASSWORD_MIN) {
    return Response.json({ error: `Use at least ${CREATOR_PASSWORD_MIN} characters.` }, { status: 400 });
  }
  const expired = "This setup link has expired or was already used. Ask The Card Doc for a new one.";
  if (!TOKEN_PATTERN.test(token)) return Response.json({ error: expired }, { status: 400 });

  const admin = createAdminClient();
  // Finding the link and using it up in one statement, so it can't be used twice
  const { data: affiliate } = await admin
    .from("affiliates")
    .update({ password_hash: await hashPassword(password), setup_token_hash: null, setup_token_expires_at: null })
    .eq("setup_token_hash", await sha256(token))
    .gt("setup_token_expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (!affiliate) return Response.json({ error: expired }, { status: 400 });

  await admin.from("affiliate_sessions").delete().eq("affiliate_id", affiliate.id);
  await createCreatorSession(affiliate.id, request.headers.get("user-agent"));
  return Response.json({ ok: true });
}
