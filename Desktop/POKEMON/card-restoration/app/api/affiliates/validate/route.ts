import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json({ error: "Code is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: affiliate, error } = await admin
    .from("affiliates")
    .select("id, name, code")
    .ilike("code", code.trim())
    .single();

  if (error || !affiliate) {
    return Response.json({ error: "Invalid code." }, { status: 404 });
  }

  return Response.json({ ok: true, name: affiliate.name });
}
