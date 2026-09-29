import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const admin = createAdminClient();

  // Confirm the order exists
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, restoration_tier")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    card_name,
    card_set,
    card_year,
    estimated_value_cents,
    notes,
    photo_urls,
    tier,
  } = body;

  if (!card_name?.trim()) {
    return Response.json({ error: "card_name is required" }, { status: 400 });
  }

  const { data: card, error: insertErr } = await admin
    .from("cards")
    .insert({
      order_id: orderId,
      card_name: card_name.trim(),
      card_set: card_set ?? null,
      card_year: card_year ?? null,
      estimated_value_cents: estimated_value_cents ?? null,
      notes: notes ?? null,
      photo_urls: photo_urls ?? [],
      service_ids: [],
      completed: false,
    })
    .select("id, card_name")
    .single();

  if (insertErr || !card) {
    console.error("[add card] insert error:", insertErr);
    return Response.json({ error: insertErr?.message ?? "Failed to add card" }, { status: 500 });
  }

  return Response.json({ card });
}
