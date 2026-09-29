import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("accountant_access")
    .select("id, name, email, password_hash, invite_token, invite_token_expires_at, created_at, last_login_at")
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}
