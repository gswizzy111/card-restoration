import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const BodySchema = z.object({
  customer_name: z.string().optional().default(""),
  customer_email: z.string().optional().default(""),
  customer_phone: z.string().optional().default(""),
  street1: z.string().optional().default(""),
  street2: z.string().optional(),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  items: z.array(z.object({
    product_id: z.string(),
    product_name: z.string(),
    quantity: z.number().int().min(1),
    price_cents: z.number().int().min(0),
  })).min(1),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const admin = createAdminClient();

  const hasAddress = d.street1 && d.city && d.state && d.zip;
  const shippingAddress = hasAddress ? {
    street1: d.street1,
    street2: d.street2 ?? null,
    city: d.city,
    state: d.state,
    zip: d.zip,
    country: "US",
  } : null;

  const subtotalCents = d.items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
  const shippingCents = hasAddress ? 599 : 0;
  const totalCents = subtotalCents + shippingCents;

  const { data: order, error } = await admin
    .from("shop_orders")
    .insert({
      stripe_session_id: `manual_${Date.now()}`,
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: d.customer_phone,
      shipping_address: shippingAddress,
      items: d.items,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      status: "paid",
    })
    .select("id")
    .single();

  if (error || !order) {
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }

  return Response.json({ orderId: order.id });
}
