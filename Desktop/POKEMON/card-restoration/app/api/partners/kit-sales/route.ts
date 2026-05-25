import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOCATED_FIELD: Record<string, string> = {
  kit:    "kits_allocated",
  polish: "polish_allocated",
  spray:  "spray_allocated",
};

async function getPartnerId() {
  const jar = await cookies();
  return jar.get("partner_session")?.value ?? null;
}

export async function POST(request: Request) {
  const partnerId = await getPartnerId();
  if (!partnerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { quantity, notes, product_type = "kit" } = await request.json();
  if (!quantity || quantity < 1) return Response.json({ error: "Invalid quantity" }, { status: 400 });
  if (!ALLOCATED_FIELD[product_type]) return Response.json({ error: "Invalid product type" }, { status: 400 });

  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partners")
    .select("id, kits_allocated, polish_allocated, spray_allocated")
    .eq("id", partnerId)
    .single();
  if (!partner) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const allocated = (partner as Record<string, number>)[ALLOCATED_FIELD[product_type]] ?? 0;

  const { data: existingSales } = await admin
    .from("partner_kit_sales")
    .select("quantity")
    .eq("partner_id", partnerId)
    .eq("product_type", product_type);

  const totalSold = (existingSales ?? []).reduce((s, r) => s + r.quantity, 0);
  if (totalSold + quantity > allocated) {
    return Response.json({ error: `Cannot exceed allocated ${product_type} count` }, { status: 400 });
  }

  const { error } = await admin.from("partner_kit_sales").insert({
    partner_id: partnerId,
    quantity,
    notes: notes?.trim() || null,
    product_type,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
