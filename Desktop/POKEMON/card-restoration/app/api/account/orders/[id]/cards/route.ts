import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { z } from "zod";

const CardPatch = z.object({
  card_name: z.string().min(1).max(200),
  card_set: z.string().max(200).optional(),
  card_year: z.string().max(10).optional(),
  card_number: z.string().max(50).optional(),
  estimated_value_cents: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  photo_urls: z.array(z.string().url()).max(8),
});

const Body = z.object({
  cards: z.array(CardPatch.extend({ id: z.string().uuid() })),
});

function shippoCarrierToken(carrier: string) {
  const map: Record<string, string> = {
    USPS: "usps", FedEx: "fedex", UPS: "ups", DHL: "dhl", DHLExpress: "dhl_express",
  };
  return map[carrier] ?? carrier.toLowerCase().replace(/\s+/g, "_");
}

async function isLockedByCarrier(order: Record<string, unknown>): Promise<boolean> {
  const trackingNum = order.inbound_tracking_number as string | null;
  const carrier = order.inbound_carrier as string | null;
  if (!trackingNum) return false;

  try {
    const track = await shippo.trackingStatus.get(
      trackingNum,
      carrier ? shippoCarrierToken(carrier) : "usps"
    );
    const st = track.trackingStatus?.status ?? "UNKNOWN";
    return ["TRANSIT", "DELIVERED", "RETURNED", "FAILURE"].includes(st);
  } catch {
    return false; // fail open — if Shippo is down, don't block the customer
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();

  // Verify order belongs to this user's email
  const { data: order } = await admin
    .from("orders")
    .select("id, customer_email, status, inbound_tracking_number, inbound_carrier")
    .eq("id", id)
    .single();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only allow editing on awaiting_cards
  if (!["awaiting_cards"].includes(order.status)) {
    return Response.json({ error: "Order cannot be edited at this stage" }, { status: 403 });
  }

  // Lock check — carrier has picked up the package
  const locked = await isLockedByCarrier(order);
  if (locked) {
    return Response.json({ error: "Your package is already in transit and can no longer be edited." }, { status: 403 });
  }

  // Update each card — only cards that belong to this order
  const { data: existingCards } = await admin
    .from("cards")
    .select("id")
    .eq("order_id", id);

  const existingIds = new Set((existingCards ?? []).map((c) => c.id));

  const updates = parsed.data.cards.filter((c) => existingIds.has(c.id));

  await Promise.all(
    updates.map(({ id: cardId, ...fields }) =>
      admin.from("cards").update({
        card_name: fields.card_name,
        card_set: fields.card_set ?? null,
        card_year: fields.card_year ?? null,
        card_number: fields.card_number ?? null,
        estimated_value_cents: fields.estimated_value_cents ?? null,
        notes: fields.notes ?? null,
        photo_urls: fields.photo_urls,
      }).eq("id", cardId)
    )
  );

  return Response.json({ ok: true });
}
