import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

// Runs daily at 8am UTC via Vercel Cron.
// Finds any subscription invoices paid in the last 48 hours that don't yet
// have a shop_order, and creates them. Acts as a safety net if the
// invoice.paid webhook missed an event.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = Math.floor(Date.now() / 1000) - 48 * 60 * 60;

  // Page through all invoices paid in last 48h
  let created = 0;
  let startingAfter: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const invoices = await stripe.invoices.list({
      status: "paid",
      created: { gte: since },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const invoice of invoices.data as Stripe.Invoice[]) {
      const subscriptionId = (invoice as { subscription?: string | null }).subscription;
      if (!subscriptionId) continue;

      // Already have a shop_order for this invoice?
      const { data: existing } = await admin
        .from("shop_orders")
        .select("id")
        .eq("stripe_session_id", invoice.id)
        .maybeSingle();
      if (existing) continue;

      // Look up subscriber record
      const { data: sub } = await admin
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (!sub) continue;

      const cronPriceCents = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 6299;
      await admin.from("shop_orders").insert({
        stripe_session_id: invoice.id,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        customer_phone: sub.customer_phone ?? "",
        shipping_address: sub.shipping_address,
        items: [{ product_id: "subscription", product_name: "Monthly Kit Club", quantity: 1, price_cents: cronPriceCents }],
        subtotal_cents: cronPriceCents,
        shipping_cents: 0,
        total_cents: cronPriceCents,
        status: "paid",
      });

      created++;
    }

    if (!invoices.has_more) break;
    startingAfter = invoices.data[invoices.data.length - 1]?.id;
  }

  console.log(`[cron/subscription-orders] created ${created} kit order(s)`);
  return Response.json({ ok: true, created });
}
