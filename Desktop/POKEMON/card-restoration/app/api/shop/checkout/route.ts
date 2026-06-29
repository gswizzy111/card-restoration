import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { isSoldOut } from "@/lib/site-config";

const BodySchema = z.object({
  items: z.array(z.object({ id: z.string(), quantity: z.number().int().positive(), slug: z.string() })).min(1),
  customer: z.object({ name: z.string().min(1), email: z.string().email(), phone: z.string().min(10) }),
  address: z.object({
    street1: z.string().min(1),
    street2: z.string().optional(),
    city: z.string().min(1),
    state: z.string(),
    zip: z.string().min(1),
    country: z.string().default("US"),
  }),
  affiliate_code: z.string().optional(),
  international_shipping_cents: z.number().int().positive().optional(),
  international_shipping_label: z.string().optional(),
});

export async function POST(request: Request) {
  if (isSoldOut()) {
    return Response.json({ error: "The shop is currently sold out. Please check back soon." }, { status: 503 });
  }

  const body = await request.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("Shop checkout validation failed:", parsed.error.flatten());
    return Response.json({ error: "Invalid order data." }, { status: 400 });
  }

  const data = parsed.data;
  const isInternational = data.address.country !== "US";

  if (isInternational && !data.international_shipping_cents) {
    return Response.json({ error: "Please calculate international shipping before proceeding." }, { status: 400 });
  }

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

  // Validate stock and build product line items
  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];
  for (const item of data.items) {
    const product = productMap[item.id];
    if (!product || !product.active) return Response.json({ error: "Product not available." }, { status: 400 });
    if (product.inventory_count < item.quantity) return Response.json({ error: `Not enough stock for ${product.name}.` }, { status: 400 });
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: product.name }, unit_amount: product.price_cents },
      quantity: item.quantity,
    });
  }

  // 6% sales tax on product subtotal (not shipping)
  const productSubtotalCents = data.items.reduce(
    (sum, item) => sum + productMap[item.id].price_cents * item.quantity,
    0
  );
  const taxCents = Math.round(productSubtotalCents * 0.06);
  lineItems.push({
    price_data: { currency: "usd", product_data: { name: "Sales Tax (6%)" }, unit_amount: taxCents },
    quantity: 1,
  });

  // For international: add shipping as a line item
  if (isInternational && data.international_shipping_cents) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `International Shipping — ${data.international_shipping_label ?? "Standard"}` },
        unit_amount: data.international_shipping_cents,
      },
      quantity: 1,
    });
  }

  // Validate affiliate/coupon code and get discount
  let validatedAffiliateCode: string | null = null;
  let discountPercent = 0;
  let stripeDiscounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  if (data.affiliate_code) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("code, discount_percent")
      .ilike("code", data.affiliate_code.trim())
      .single();
    if (!affiliate) return Response.json({ error: "Invalid creator code." }, { status: 400 });
    validatedAffiliateCode = affiliate.code;
    discountPercent = affiliate.discount_percent ?? 0;
    if (discountPercent > 0) {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: discountPercent,
          duration: "once",
          name: `${discountPercent}% Off — ${validatedAffiliateCode}`,
        });
        stripeDiscounts = [{ coupon: coupon.id }];
      } catch (err) {
        console.error("Failed to create Stripe coupon:", err);
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  const metadata: Record<string, string> = {
    type: "shop",
    customer_name: data.customer.name,
    customer_phone: data.customer.phone,
    items: JSON.stringify(data.items.map((i) => ({ id: i.id, qty: i.quantity }))),
    affiliate_code: validatedAffiliateCode ?? "",
  };

  if (isInternational) {
    metadata.is_international = "true";
    metadata.shipping_address_json = JSON.stringify({
      street1: data.address.street1,
      street2: data.address.street2 ?? null,
      city: data.address.city,
      state: data.address.state,
      zip: data.address.zip,
      country: data.address.country,
    });
  }

  let session;
  try {
    if (isInternational) {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: data.customer.email,
        line_items: lineItems,
        discounts: stripeDiscounts,
        success_url: `${appUrl}/shop/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/cart`,
        metadata,
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: data.customer.email,
        line_items: lineItems,
        discounts: stripeDiscounts,
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
        metadata,
      });
    }
  } catch (err) {
    console.error("Stripe shop session error:", err);
    return Response.json({ error: "Payment provider error. Please try again." }, { status: 500 });
  }

  return Response.json({ url: session.url });
}
