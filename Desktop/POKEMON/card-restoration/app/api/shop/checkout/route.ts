import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { isSoldOut } from "@/lib/site-config";
import { addressProblem, normalizeAddress } from "@/lib/shipping-address";
import { usAddressRejection } from "@/lib/verify-address";
import { likeExact } from "@/lib/like-exact";

const BodySchema = z.object({
  items: z.array(z.object({ id: z.string(), quantity: z.number().int().positive(), slug: z.string(), size: z.string().optional() })).min(1),
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
  gift_card_code: z.string().optional(),
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

  // No kit is paid for without a shippable address: complete, with a house
  // number, a real state and ZIP, and (US) one USPS recognises.
  const address = normalizeAddress({ ...data.address, country: isInternational ? data.address.country : "US" });
  const problem = addressProblem(address);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (!isInternational) {
    const rejection = await usAddressRejection(address, data.customer.name);
    if (rejection) {
      const advice = /please check/i.test(rejection) ? "" : " Please check it and try again.";
      return Response.json({ error: `We couldn't verify that address with USPS: ${rejection}${advice}` }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  // Strip size suffix (e.g. "gloves-Medium" → "gloves") for DB lookup
  const baseId = (id: string) => id.replace(/-(?:Small|Medium|Large|XL)$/i, "");

  // Fetch products from DB (never trust client prices)
  const productIds = data.items.map((i) => baseId(i.id));
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
    const product = productMap[baseId(item.id)];
    if (!product || !product.active) return Response.json({ error: "Product not available." }, { status: 400 });
    if (product.inventory_count < item.quantity) return Response.json({ error: `Not enough stock for ${product.name}.` }, { status: 400 });
    const displayName = item.size ? `${product.name} — ${item.size}` : product.name;
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: displayName }, unit_amount: product.price_cents },
      quantity: item.quantity,
    });
  }

  const productSubtotalCents = data.items.reduce(
    (sum, item) => sum + (productMap[baseId(item.id)]?.price_cents ?? 0) * item.quantity,
    0
  );

  // Validate affiliate/coupon code and get discount
  let validatedAffiliateCode: string | null = null;
  let discountPercent = 0;
  if (data.affiliate_code) {
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("code, discount_percent")
      .ilike("code", likeExact(data.affiliate_code.trim()))
      .single();
    if (!affiliate) return Response.json({ error: "Invalid creator code." }, { status: 400 });
    validatedAffiliateCode = affiliate.code;
    discountPercent = affiliate.discount_percent ?? 0;
  }
  // Same math as the cart checkout page: discount on products, tax after discount
  const discountCents = discountPercent > 0 ? Math.round(productSubtotalCents * discountPercent / 100) : 0;

  // 6.625% sales tax on discounted product subtotal (not shipping)
  const taxCents = Math.round((productSubtotalCents - discountCents) * 0.06625);
  lineItems.push({
    price_data: { currency: "usd", product_data: { name: "Sales Tax (6.625%)" }, unit_amount: taxCents },
    quantity: 1,
  });

  // Shipping is a line item: the checked address above is the ship-to, so
  // Stripe's page doesn't collect another one
  if (!isInternational) {
    lineItems.push({
      price_data: { currency: "usd", product_data: { name: "Standard Shipping" }, unit_amount: 599 },
      quantity: 1,
    });
  }
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

  // Gift card
  let giftCardDiscountCents = 0;
  let giftCardId: string | null = null;
  if (data.gift_card_code) {
    const gcCode = data.gift_card_code.trim().toUpperCase();
    const { data: gc } = await admin
      .from("gift_cards")
      .select("id, remaining_cents, status")
      .eq("code", gcCode)
      .maybeSingle();
    if (gc && gc.status === "active" && gc.remaining_cents > 0) {
      giftCardId = gc.id;
      const preTaxTotal = productSubtotalCents - discountCents + taxCents + (isInternational ? (data.international_shipping_cents ?? 0) : 0);
      giftCardDiscountCents = Math.min(gc.remaining_cents, preTaxTotal);
    }
  }

  // Discount and gift card go to Stripe as one fixed-amount coupon (Stripe
  // refuses negative line items)
  let stripeDiscounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  const couponCents = discountCents + giftCardDiscountCents;
  if (couponCents > 0) {
    const couponName = [
      discountCents > 0 ? `${discountPercent}% Off — ${validatedAffiliateCode}` : null,
      giftCardDiscountCents > 0 ? `Gift Card (${data.gift_card_code?.trim().toUpperCase()})` : null,
    ].filter(Boolean).join(" + ").slice(0, 40);
    try {
      const coupon = await stripe.coupons.create({
        amount_off: couponCents,
        currency: "usd",
        duration: "once",
        name: couponName,
      });
      stripeDiscounts = [{ coupon: coupon.id }];
    } catch (err) {
      console.error("Failed to create Stripe coupon:", err);
      return Response.json({ error: "Payment provider error. Please try again." }, { status: 500 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";

  const metadata: Record<string, string> = {
    type: "shop",
    customer_name: data.customer.name,
    customer_phone: data.customer.phone,
    items: JSON.stringify(data.items.map((i) => ({ id: baseId(i.id), qty: i.quantity, size: i.size ?? null }))),
    affiliate_code: validatedAffiliateCode ?? "",
    gift_card_id: giftCardId ?? "",
    gift_card_discount_cents: giftCardDiscountCents > 0 ? String(giftCardDiscountCents) : "",
  };

  // The checked address travels with the order; the webhook ships to it
  metadata.shipping_address_json = JSON.stringify(address);
  if (isInternational) metadata.is_international = "true";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customer.email,
      line_items: lineItems,
      discounts: stripeDiscounts,
      success_url: `${appUrl}/shop/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,
      metadata,
    });
  } catch (err) {
    console.error("Stripe shop session error:", err);
    return Response.json({ error: "Payment provider error. Please try again." }, { status: 500 });
  }

  return Response.json({ url: session.url });
}
