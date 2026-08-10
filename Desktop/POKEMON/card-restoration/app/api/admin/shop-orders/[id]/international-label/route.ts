import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessAddress } from "@/lib/shippo";
import { pmGetQuotes, pmCreateShipment } from "@/lib/parcel-monkey";
import type { PmBox, PmAddress } from "@/lib/parcel-monkey";
import { z } from "zod";

export const maxDuration = 60;

const BOX_KEYWORDS = ["official", "essential", "clamp"];

function getBox(items: { product_name: string }[] | null): PmBox {
  const names = (items ?? []).map((i) => i.product_name ?? "");
  const needsBox = names.some((n) => BOX_KEYWORDS.some((kw) => n.toLowerCase().includes(kw)));
  // Dimensions in cm, weight in kg
  return needsBox
    ? { length: 25, width: 18, height: 18, weight: 1.8 }
    : { length: 20, width: 13, height: 3, weight: 0.2 };
}

type ShippingAddress = {
  street1: string; street2?: string; city: string; state?: string; zip: string; country: string;
};

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

// GET — return Parcel Monkey quotes for this order
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("*").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const addr = order.shipping_address as ShippingAddress | null;
  if (!addr?.country || addr.country === "US") {
    return Response.json({ error: "Not an international order" }, { status: 400 });
  }

  const box = getBox(order.items as { product_name: string }[] | null);
  const { quotes, error } = await pmGetQuotes({
    senderCountry: "US",
    recipient: { country: addr.country },
    boxes: [box],
  });

  if (error) return Response.json({ error }, { status: 500 });
  if (quotes.length === 0) return Response.json({ error: "No Parcel Monkey quotes available for this destination." }, { status: 400 });

  // Return existing international labels too
  const existingLabels = (order as Record<string, unknown>).international_labels as unknown[] ?? [];

  return Response.json({ quotes, existingLabels });
}

const PostBody = z.object({
  service_id: z.string().min(1),
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customs_required: z.boolean(),
  declared_value_cents: z.number().int().min(0).default(0),
});

// POST — book the shipment with Parcel Monkey
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("*").eq("id", id).single();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const addr = order.shipping_address as ShippingAddress | null;
  if (!addr?.country || addr.country === "US") {
    return Response.json({ error: "Not an international order" }, { status: 400 });
  }

  const box = getBox(order.items as { product_name: string }[] | null);

  const sender: PmAddress = {
    name: businessAddress.name || "The Card Doc",
    company: "The Card Doc",
    address1: businessAddress.street1,
    address2: businessAddress.street2 || undefined,
    city: businessAddress.city,
    county: businessAddress.state,
    postcode: businessAddress.zip,
    country: "US",
    phone: businessAddress.phone,
    email: businessAddress.email,
  };

  const recipient: PmAddress = {
    name: order.customer_name ?? "Customer",
    company: "",
    address1: addr.street1,
    address2: addr.street2 || undefined,
    city: addr.city,
    county: addr.state ?? undefined,
    postcode: addr.zip,
    country: addr.country,
    phone: order.customer_phone ?? "",
    email: order.customer_email ?? "",
  };

  const { result, error } = await pmCreateShipment({
    serviceId: parsed.data.service_id,
    collectionDate: parsed.data.collection_date,
    sender,
    recipient,
    boxes: [box],
    description: "Card restoration kit — trading card accessories",
    valueCents: parsed.data.declared_value_cents,
    currency: "USD",
    customsRequired: parsed.data.customs_required,
  });

  if (error || !result) return Response.json({ error: error ?? "Shipment creation failed" }, { status: 500 });

  // Save to DB — append to international_labels jsonb array + update tracking
  const newEntry = {
    shipment_id: result.shipment_id,
    label_url: result.label_url,
    customs_url: result.customs_invoice_url,
    tracking_number: result.tracking_number,
    service_id: parsed.data.service_id,
    created_at: new Date().toISOString(),
  };

  const existingLabels = (order as Record<string, unknown>).international_labels as unknown[] ?? [];
  const allLabels = [...existingLabels, newEntry];

  // Try saving with international_labels column; fall back to just tracking/status
  const { error: dbErr } = await (admin as any)
    .from("shop_orders")
    .update({ international_labels: allLabels, status: "shipped", tracking_number: result.tracking_number })
    .eq("id", id);

  if (dbErr) {
    await admin
      .from("shop_orders")
      .update({ status: "shipped", tracking_number: result.tracking_number })
      .eq("id", id);
  }

  return Response.json({ result: newEntry, allLabels });
}
