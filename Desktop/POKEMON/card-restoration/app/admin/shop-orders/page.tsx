import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import Stripe from "stripe";
import { ReturnLabelButton } from "./return-label-button";
import { KitStatusUpdater } from "./status-updater";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  paid:       "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-emerald-100 text-emerald-700",
};

type ShopOrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  price_cents: number;
};

type ShippingAddress = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

async function syncFromStripe() {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("shop_orders")
    .select("stripe_session_id");
  const existingIds = new Set((existing ?? []).map((o) => o.stripe_session_id));

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
    if (toInsert.length >= 500) break;
  }

  if (toInsert.length > 0) {
    await admin.from("shop_orders").insert(toInsert);
  }
}

export default async function ShopOrdersPage() {
  const admin = createAdminClient();

  // Sync any Stripe kit orders not yet in the DB
  try {
    await syncFromStripe();
  } catch (err) {
    console.error("Stripe sync error:", err);
  }

  const { data: orders } = await admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Kit Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{orders?.length ?? 0} total</p>
          </div>
        </div>

        {(!orders || orders.length === 0) && (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No kit orders found.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {orders?.map((order) => {
            const address = order.shipping_address as ShippingAddress | null;
            const items = (order.items ?? []) as ShopOrderItem[];

            return (
              <div key={order.id} className="bg-white rounded-xl border border-border p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <KitStatusUpdater orderId={order.id} currentStatus={order.status} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border pt-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Items Ordered</p>
                    <div className="flex flex-col gap-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.product_name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                          <span className="font-medium text-foreground">{formatCurrency(item.price_cents * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm text-muted-foreground pt-1 border-t border-border mt-1">
                        <span>Shipping</span>
                        <span>{formatCurrency(order.shipping_cents ?? 599)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Ship To</p>
                    {address ? (
                      <div className="text-sm text-foreground leading-relaxed">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-muted-foreground">{address.street1}{address.street2 ? `, ${address.street2}` : ""}</p>
                        <p className="text-muted-foreground">{address.city}, {address.state} {address.zip}</p>
                        <p className="text-muted-foreground">{address.country}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No address on file</p>
                    )}
                    {address && (
                      <ReturnLabelButton orderId={order.id} existingLabelUrl={order.return_label_url} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
