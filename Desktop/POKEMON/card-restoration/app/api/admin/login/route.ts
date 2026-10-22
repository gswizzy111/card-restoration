import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/crypto";
import { ADMIN_SESSION_COOKIE, LEGACY_ADMIN_COOKIE, createAdminSession } from "@/lib/admin-session";

const Body = z.object({
  username: z.string().trim().max(100).optional(),
  email: z.string().trim().max(320).optional(),
  password: z.string().min(1).max(200),
});

// A hash that matches nothing, so an unknown username takes as long to refuse
// as a wrong password (no telling which usernames exist)
const NO_MATCH_HASH = "AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

async function startSession(
  who: { role: "admin"; adminUserId: string } | { role: "accountant"; accountantId: string },
  request: Request
) {
  const token = await createAdminSession(who, request.headers.get("user-agent"));
  const jar = await cookies();
  // No max-age: the session ends when the browser closes (and after 12 hours at most)
  jar.set(ADMIN_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  jar.delete(LEGACY_ADMIN_COOKIE);
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Enter your username and password." }, { status: 400 });
  const { username, email, password } = parsed.data;
  const admin = createAdminClient();

  // ── Accountant login (email + password) ──────────────────────────────────
  if (email) {
    const { data: accountant } = await admin
      .from("accountant_access")
      .select("id, password_hash")
      .eq("email", email.toLowerCase())
      .not("password_hash", "is", null)
      .maybeSingle();
    const valid = await verifyPassword(password, accountant?.password_hash ?? NO_MATCH_HASH);
    if (!accountant || !valid) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    await startSession({ role: "accountant", accountantId: accountant.id }, request);
    await admin.from("accountant_access").update({ last_login_at: new Date().toISOString() }).eq("id", accountant.id);
    return Response.json({ ok: true, role: "accountant" });
  }

  // ── Admin login (username + password) ────────────────────────────────────
  if (!username) return Response.json({ error: "Enter your username and password." }, { status: 400 });
  const { data: user } = await admin
    .from("admin_users")
    .select("id, password_hash")
    .eq("username", username.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  const valid = await verifyPassword(password, user?.password_hash ?? NO_MATCH_HASH);
  if (!user || !valid) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }
  await startSession({ role: "admin", adminUserId: user.id }, request);
  await admin.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  return Response.json({ ok: true, role: "admin" });
}
