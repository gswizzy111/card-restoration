import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function getPartnerId() {
  const jar = await cookies();
  return jar.get("partner_session")?.value ?? null;
}

export async function POST(request: Request) {
  const partnerId = await getPartnerId();
  if (!partnerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { client_name, notes } = await request.json();

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("id").eq("id", partnerId).single();
  if (!partner) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await admin.from("partner_referrals").insert({
    partner_id: partnerId,
    client_name: client_name?.trim() || null,
    notes: notes?.trim() || null,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
