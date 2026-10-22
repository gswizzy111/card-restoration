import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { ADMIN_SESSION_COOKIE, endSessionsFor } from "@/lib/admin-session";
import { passwordProblem, sendAdminEmail } from "@/lib/admin-password";
import { escapeHtml } from "@/lib/card-inquiries";
import { businessName } from "@/lib/resend";

const Body = z.object({ current_password: z.string().max(200), new_password: z.string().max(200) });

// The signed-in admin changes their own password. Their other sign-ins end;
// this browser stays signed in.
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (session?.role !== "admin" || !session.adminUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { current_password, new_password } = parsed.data;

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("admin_users")
    .select("password_hash, email")
    .eq("id", session.adminUserId)
    .single();
  if (!user || !(await verifyPassword(current_password, user.password_hash))) {
    return Response.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  const problem = passwordProblem(new_password);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (new_password === current_password) {
    return Response.json({ error: "Choose a password different from your current one." }, { status: 400 });
  }

  const { error } = await admin
    .from("admin_users")
    .update({ password_hash: await hashPassword(new_password) })
    .eq("id", session.adminUserId);
  if (error) return Response.json({ error: "Could not save. Please try again." }, { status: 500 });

  const jar = await cookies();
  await endSessionsFor({ adminUserId: session.adminUserId }, jar.get(ADMIN_SESSION_COOKIE)?.value);
  // Reset links sent before the change no longer work
  await admin.from("admin_password_resets").delete().eq("admin_user_id", session.adminUserId);
  if (user.email) {
    await sendAdminEmail(
      user.email,
      `${businessName}: your admin password was changed`,
      "Your password was changed",
      `The password for the admin login <strong>${escapeHtml(session.username)}</strong> was just changed. If this wasn't you, use "Forgot password?" on the admin sign-in page to set a new one.`,
    );
  }
  return Response.json({ ok: true });
}
