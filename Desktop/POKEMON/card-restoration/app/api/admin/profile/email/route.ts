import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { verifyPassword } from "@/lib/crypto";
import { sendAdminEmail } from "@/lib/admin-password";
import { escapeHtml } from "@/lib/card-inquiries";
import { businessName } from "@/lib/resend";

const Body = z.object({ current_password: z.string().max(200), email: z.string().trim().max(320) });

// The signed-in admin sets the email that "Forgot password?" sends reset
// links to. Asks for the current password, and tells both the old and the
// new address.
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (session?.role !== "admin" || !session.adminUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("admin_users")
    .select("password_hash, email")
    .eq("id", session.adminUserId)
    .single();
  if (!user || !(await verifyPassword(parsed.data.current_password, user.password_hash))) {
    return Response.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  if (user.email === email) return Response.json({ ok: true, email });

  const { error } = await admin.from("admin_users").update({ email }).eq("id", session.adminUserId);
  if (error) {
    if (error.code === "23505") return Response.json({ error: "Another admin already uses that email." }, { status: 400 });
    return Response.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
  // Reset links sent to the old address no longer work
  await admin.from("admin_password_resets").delete().eq("admin_user_id", session.adminUserId);

  const who = `<strong>${escapeHtml(session.username)}</strong>`;
  const sent = await sendAdminEmail(
    email,
    `${businessName}: recovery email for your admin login`,
    "Recovery email saved",
    `This is now the recovery email for the admin login ${who}. If you forget your password, "Forgot password?" on the admin sign-in page sends a reset link here.`,
  );
  if (user.email) {
    await sendAdminEmail(
      user.email,
      `${businessName}: recovery email changed`,
      "Recovery email changed",
      `The recovery email for the admin login ${who} was changed to ${escapeHtml(email)}. If this wasn't you, contact another admin.`,
    );
  }
  return Response.json({ ok: true, email, sent });
}
