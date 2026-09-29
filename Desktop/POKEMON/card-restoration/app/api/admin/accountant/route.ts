import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/crypto";
import { resend, fromEmail, businessName } from "@/lib/resend";
import { z } from "zod";

const InviteBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = InviteBody.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Name and email required." }, { status: 400 });

  const { name, email } = parsed.data;
  const admin = createAdminClient();
  const token = generateToken();
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // Upsert so re-inviting the same email refreshes the token
  const { error } = await admin.from("accountant_access").upsert(
    { name, email: email.toLowerCase().trim(), invite_token: token, invite_token_expires_at: expires, password_hash: null },
    { onConflict: "email" }
  );

  if (error) {
    console.error("Accountant invite error:", error);
    return Response.json({ error: "Failed to create invite." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const setupUrl = `${appUrl}/accountant/setup?token=${token}`;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to access The Card Doc admin — ${businessName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
          <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">You've been invited</h1>
          <p>Hi ${name.split(" ")[0]}, you've been granted accountant access to The Card Doc admin dashboard.</p>
          <p style="color:#555;font-size:14px">You'll be able to view tax reports, P&L, statements, and orders — but won't be able to make any changes.</p>
          <div style="margin:28px 0">
            <a href="${setupUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
              Set Your Password →
            </a>
          </div>
          <p style="font-size:12px;color:#999">This link expires in 48 hours. If you didn't expect this email, you can safely ignore it.</p>
          <p style="font-size:13px;color:#666">${businessName}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send accountant invite email:", err);
    return Response.json({ error: "Invite created but email failed to send. Check server logs." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  await requireAdmin();
  const { id } = await request.json().catch(() => ({}));
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  const admin = createAdminClient();
  await admin.from("accountant_access").delete().eq("id", id);
  return Response.json({ ok: true });
}
