import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get session IDs already in the DB so we don't duplicate
  const { data: existing } = await admin
    .from("shop_orders")
    .select("stripe_session_id");
  const existingIds = new Set((existing ?? []).map((o) => o.stripe_session_id));

  // Page through all completed Stripe sessions
  const toInsert: Record<string, unknown>[] = [];
  let startingAfter: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: "complete",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const session of sessions.data) {
      if (session.metadata?.type !== "shop") continue;
      if (existingIds.has(session.id)) continue;

      const items: { id: string; qty: number }[] = JSON.parse(session.metadata.items ?? "[]");
      const productIds = items.map((i) => i.id).filter(Boolean);

      // Fetch product names from DB
      const { data: products } = productIds.length > 0
        ? await admin.from("products").select("id, name, price_cents").in("id", productIds)
        : { data: [] };
      const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));

      const itemsForDb = items.map((i) => ({
        product_id: i.id,
        product_name: productMap[i.id]?.name ?? "Unknown product",
        quantity: i.qty,
        price_cents: productMap[i.id]?.price_cents ?? 0,
      }));

      const typedSession = session as Stripe.Checkout.Session;
      const addr = typedSession.collected_information?.shipping_details?.address;
      const shippingAddress = addr ? {
        street1: addr.line1 ?? "",
        street2: addr.line2 ?? null,
        city: addr.city ?? "",
        state: addr.state ?? "",
        zip: addr.postal_code ?? "",
        country: addr.country ?? "US",
      } : null;

      const totalCents = session.amount_total ?? 0;

      toInsert.push({
        stripe_session_id: session.id,
        customer_name: session.metadata.customer_name ?? session.customer_details?.name ?? "",
        customer_email: session.customer_email ?? session.customer_details?.email ?? "",
        customer_phone: session.metadata.customer_phone ?? "",
        shipping_address: shippingAddress,
        items: itemsForDb,
        subtotal_cents: Math.max(0, totalCents - 599),
        shipping_cents: 599,
        total_cents: totalCents,
        status: "paid",
      });
    }

    if (!sessions.has_more) break;
    startingAfter = sessions.data[sessions.data.length - 1]?.id;
    if (toInsert.length >= 500) break; // safety cap
  }

  if (toInsert.length > 0) {
    const { error } = await admin.from("shop_orders").insert(toInsert);
    if (error) {
      console.error("Sync insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ synced: toInsert.length });
}
