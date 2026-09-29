import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/crypto";

export async function POST(request: Request) {
  const { password, email } = await request.json();

  // ── Full admin login (password only) ─────────────────────────────────────
  if (!email) {
    if (password !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }
    const jar = await cookies();
    jar.set("admin_auth", process.env.ADMIN_PASSWORD!, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return Response.json({ ok: true, role: "admin" });
  }

  // ── Accountant login (email + password) ──────────────────────────────────
  const admin = createAdminClient();
  const { data: accountant } = await admin
    .from("accountant_access")
    .select("id, password_hash")
    .eq("email", email.toLowerCase().trim())
    .not("password_hash", "is", null)
    .maybeSingle();

  if (!accountant) {
    return Response.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, accountant.password_hash!);
  if (!valid) {
    return Response.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const jar = await cookies();
  jar.set("admin_auth", `act_${accountant.id}`, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ ok: true, role: "accountant" });
}
