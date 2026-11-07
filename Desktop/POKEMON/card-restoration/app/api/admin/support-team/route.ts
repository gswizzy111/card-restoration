import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { newToken, sha256 } from "@/lib/admin-session";
import { sendAdminEmail } from "@/lib/admin-password";
import { escapeHtml } from "@/lib/card-inquiries";
import { businessName } from "@/lib/resend";

/**
 * Support Access (admins only): invite customer support staff, list them and
 * remove them. An invite emails a link to /support/setup where they choose a
 * password; the database keeps only the link's SHA-256. Removing someone
 * deletes their row, which ends their sessions too (on delete cascade).
 */
const INVITE_HOURS = 48;

const InviteBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(320),
});

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_access")
    .select("id, name, email, password_hash, invite_token_expires_at, created_at, last_login_at")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Could not load the support team." }, { status: 500 });
  // Never send password hashes to the browser: just whether one is set
  return Response.json(
    (data ?? []).map(({ password_hash, ...m }) => ({ ...m, active: !!password_hash }))
  );
}

export async function POST(request: Request) {
  await requireAdmin();
  const parsed = InviteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a name and a valid email." }, { status: 400 });
  const { name, email } = parsed.data;
  const admin = createAdminClient();

  const { data: existing } = await admin.from("support_access").select("id, password_hash").eq("email", email).maybeSingle();
  if (existing?.password_hash) {
    return Response.json({ error: `${email} already has support access.` }, { status: 409 });
  }

  const token = newToken();
  const row = {
    name,
    email,
    invite_token: await sha256(token),
    invite_token_expires_at: new Date(Date.now() + INVITE_HOURS * 3600_000).toISOString(),
  };
  const { error } = existing
    ? await admin.from("support_access").update(row).eq("id", existing.id)
    : await admin.from("support_access").insert(row);
  if (error) {
    console.error("Support invite error:", error.message);
    return Response.json({ error: "Could not create the invite." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const sent = await sendAdminEmail(
    email,
    `You've been invited to The Card Doc support team`,
    "You've been invited",
    `Hi ${escapeHtml(name.split(/\s+/)[0])}, you've been given customer support access to the ${escapeHtml(businessName)} admin. You'll be able to look up orders and tracking, answer update requests and support cases, and see emails that didn't reach a customer. Tap the button to choose your password.`,
    {
      label: "Set your password",
      href: `${appUrl}/support/setup?token=${token}`,
      note: `This link works once and expires in ${INVITE_HOURS} hours. Didn't expect this email? You can ignore it.`,
    },
  );
  if (!sent) {
    return Response.json({ error: "The invite was saved but the email didn't send. Try Resend." }, { status: 502 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  await requireAdmin();
  const { id } = await request.json().catch(() => ({}));
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Missing id." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("support_access").delete().eq("id", id);
  if (error) return Response.json({ error: "Could not remove them. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
