import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { passcode } = await request.json();
  if (!passcode) return Response.json({ error: "Passcode required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id, name, store_name")
    .eq("passcode", passcode.trim())
    .single();

  if (!partner) return Response.json({ error: "Invalid passcode" }, { status: 401 });

  const response = Response.json({ ok: true, name: partner.name });
  response.headers.set(
    "Set-Cookie",
    `partner_session=${partner.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return response;
}
