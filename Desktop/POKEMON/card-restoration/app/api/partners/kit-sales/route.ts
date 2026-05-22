import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function getPartnerId() {
  const jar = await cookies();
  return jar.get("partner_session")?.value ?? null;
}

export async function POST(request: Request) {
  const partnerId = await getPartnerId();
  if (!partnerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { quantity, notes } = await request.json();
  if (!quantity || quantity < 1) return Response.json({ error: "Invalid quantity" }, { status: 400 });

  const admin = createAdminClient();

  // Verify partner exists
  const { data: partner } = await admin.from("partners").select("id, kits_allocated").eq("id", partnerId).single();
  if (!partner) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Check they haven't over-reported
  const { data: existingSales } = await admin
    .from("partner_kit_sales")
    .select("quantity")
    .eq("partner_id", partnerId);
  const totalSold = (existingSales ?? []).reduce((s, r) => s + r.quantity, 0);
  if (totalSold + quantity > partner.kits_allocated) {
    return Response.json({ error: "Cannot exceed allocated kit count" }, { status: 400 });
  }

  const { error } = await admin.from("partner_kit_sales").insert({
    partner_id: partnerId,
    quantity,
    notes: notes?.trim() || null,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
