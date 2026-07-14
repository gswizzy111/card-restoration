import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const BodySchema = z.object({
  price_per_card_cents: z.number().int().positive(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cards: z.array(z.object({
    id: z.string().nullable(),
    name: z.string().min(1),
  })).min(1),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const admin = createAdminClient();
  const totalCents = d.price_per_card_cents * d.cards.length;

  // Update order totals, due date, notes
  const { error: orderErr } = await admin
    .from("orders")
    .update({
      subtotal_cents: totalCents,
      total_cents: totalCents,
      customer_notes: d.notes ?? null,
      due_date: d.due_date ?? null,
    })
    .eq("id", orderId);

  if (orderErr) {
    console.error("Failed to update order:", orderErr);
    return Response.json({ error: "Failed to update order" }, { status: 500 });
  }

  // Replace order_services with updated pricing
  await admin.from("order_services").delete().eq("order_id", orderId);
  await admin.from("order_services").insert({
    order_id: orderId,
    service_name: "Manual Restoration Order",
    price_cents: d.price_per_card_cents,
    quantity: d.cards.length,
  });

  // Replace cards: delete all, re-insert
  await admin.from("cards").delete().eq("order_id", orderId);
  await admin.from("cards").insert(
    d.cards.map((c) => ({
      order_id: orderId,
      card_name: c.name,
      photo_urls: [],
      service_ids: [],
    }))
  );

  // Log the change
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "order_edited",
    description: `Order updated by admin — ${d.cards.length} card${d.cards.length !== 1 ? "s" : ""} @ $${(d.price_per_card_cents / 100).toFixed(2)}/card — new total $${(totalCents / 100).toFixed(2)}`,
    is_customer_visible: false,
  });

  return Response.json({ ok: true });
}
