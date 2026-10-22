import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { newToken, sha256 } from "@/lib/admin-session";
import { SETUP_LINK_DAYS } from "@/lib/creator-portal";

// A one-time link for the creator to choose their portal password (first
// time, or when they forget it). A new link replaces the last one; their
// current password keeps working until the link is used.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const token = newToken();
  const expiresAt = new Date(Date.now() + SETUP_LINK_DAYS * 86400_000).toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("affiliates")
    .update({ setup_token_hash: await sha256(token), setup_token_expires_at: expiresAt })
    .eq("id", id)
    .select("id");
  if (error) return Response.json({ error: "Could not make a link. Please try again." }, { status: 500 });
  if (!data?.length) return Response.json({ error: "Code not found." }, { status: 404 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  return Response.json({ ok: true, url: `${appUrl}/affiliates/setup?token=${token}`, expires_at: expiresAt });
}

// Turns the creator's portal access off: clears the password and any setup
// link, and signs them out.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  await admin.from("affiliates").update({ password_hash: null, setup_token_hash: null, setup_token_expires_at: null }).eq("id", id);
  await admin.from("affiliate_sessions").delete().eq("affiliate_id", id);
  return Response.json({ ok: true });
}
