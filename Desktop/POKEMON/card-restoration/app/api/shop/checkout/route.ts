import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

const BodySchema = z.object({
  items: z.array(z.object({ id: z.string(), quantity: z.number().int().positive(), slug: z.string() })).min(1),
  customer: z.object({ name: z.string().min(1), email: z.string().email(), phone: z.string().min(10) }),
  address: z.object({
    street1: z.string().min(1),
    street2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(5),
  }),
  affiliate_code: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("Shop checkout validation failed:", parsed.error.flatten());
    return Response.json({ error: "Invalid order data." }, { status: 400 });
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // Fetch products from DB (never trust client prices)
  const productIds = data.items.map((i) => i.id);
  const { data: products, error: pErr } = await admin
    .from("products")
    .select("id, name, price_cents, inventory_count, active")
    .in("id", productIds);

  if (pErr || !products) {
    return Response.json({ error: "Failed to load products." }, { status: 500 });
  }

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  // Validate stock and build line items
  const lineItems = [];
  for (const item of data.items) {
    const product = productMap[item.id];
    if (!product || !product.active) return Response.json({ error: `Product not available.` }, { status: 400 });
    if (product.inventory_count < item.quantity) return Response.json({ error: `Not enough stock for ${product.name}.` }, { status: 400 });
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: product.name },
        unit_amount: product.price_cents,
      },
      quantity: item.quantity,
    });
  }

  // Validate affiliate code if provided
  let validatedAffiliateCode: string | null = null;
  if (data.affiliate_code) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("code")
      .ilike("code", data.affiliate_code.trim())
      .single();
    if (!affiliate) {
      return Response.json({ error: "Invalid creator code." }, { status: 400 });
    }
    validatedAffiliateCode = affiliate.code;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customer.email,
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 599, currency: "usd" },
            display_name: "Standard Shipping",
            delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 7 } },
          },
        },
      ],
      success_url: `${appUrl}/shop/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,
      metadata: {
        type: "shop",
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        items: JSON.stringify(data.items.map((i) => ({ id: i.id, qty: i.quantity }))),
        affiliate_code: validatedAffiliateCode ?? "",
      },
    });
  } catch (err) {
    console.error("Stripe shop session error:", err);
    return Response.json({ error: "Payment provider error. Please try again." }, { status: 500 });
  }

  return Response.json({ url: session.url });
}
