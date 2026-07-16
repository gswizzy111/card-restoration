import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import Stripe from "stripe";
import { ReturnLabelButton } from "./return-label-button";
import { KitStatusUpdater } from "./status-updater";
import { KitCustomerEditor } from "./kit-customer-editor";
import { RevenueChart } from "../revenue-chart";
import { SyncKitOrdersButton } from "./sync-kit-orders-button";

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

// Fast auto-sync: only checks the 15 most recent Stripe sessions (single API call).
// Use the "Sync All Orders" button to backfill older history.
async function syncRecentFromStripe() {
  const admin = createAdminClient();

  const sessions = await stripe.checkout.sessions.list({ limit: 15, status: "complete" });
  const shopSessions = sessions.data.filter((s) => s.metadata?.type === "shop");
  if (shopSessions.length === 0) return;

  const { data: existing } = await admin
    .from("shop_orders")
    .select("stripe_session_id")
    .in("stripe_session_id", shopSessions.map((s) => s.id));
  const existingIds = new Set((existing ?? []).map((o) => o.stripe_session_id));

  const newSessions = shopSessions.filter((s) => !existingIds.has(s.id));
  if (newSessions.length === 0) return;

  const productIds = [...new Set(newSessions.flatMap((s) => {
    const items: { id: string }[] = JSON.parse(s.metadata?.items ?? "[]");
    return items.map((i) => i.id).filter(Boolean);
  }))];
  const { data: products } = productIds.length > 0
    ? await admin.from("products").select("id, name, price_cents").in("id", productIds)
    : { data: [] };
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));

  const toInsert = newSessions.map((session) => {
    const items: { id: string; qty: number }[] = JSON.parse(session.metadata?.items ?? "[]");
    const itemsForDb = items.map((i) => ({
      product_id: i.id,
      product_name: productMap[i.id]?.name ?? "Unknown product",
      quantity: i.qty,
      price_cents: productMap[i.id]?.price_cents ?? 0,
    }));

    const typedSession = session as Stripe.Checkout.Session;
    const addr = typedSession.collected_information?.shipping_details?.address;
    let shippingAddress = addr ? {
      street1: addr.line1 ?? "",
      street2: addr.line2 ?? null,
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip: addr.postal_code ?? "",
      country: addr.country ?? "US",
    } : null;

    const isInternational = session.metadata?.is_international === "true";
    if (!shippingAddress && isInternational && session.metadata?.shipping_address_json) {
      try { shippingAddress = JSON.parse(session.metadata.shipping_address_json); } catch { /* ignore */ }
    }

    const totalCents = session.amount_total ?? 0;
    const shippingCents = isInternational
      ? (totalCents - (session.amount_subtotal ?? totalCents - 599))
      : 599;

    return {
      stripe_session_id: session.id,
      customer_name: session.metadata?.customer_name ?? session.customer_details?.name ?? "",
      customer_email: session.customer_email ?? session.customer_details?.email ?? "",
      customer_phone: session.metadata?.customer_phone ?? "",
      shipping_address: shippingAddress,
      items: itemsForDb,
      subtotal_cents: Math.max(0, totalCents - shippingCents),
      shipping_cents: shippingCents,
      total_cents: totalCents,
      status: "paid",
      affiliate_code: session.metadata?.affiliate_code || null,
    };
  });

  if (toInsert.length > 0) {
    await admin.from("shop_orders").insert(toInsert);
  }
}

export default async function ShopOrdersPage() {
  const admin = createAdminClient();

  await syncRecentFromStripe();

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
          <SyncKitOrdersButton />
        </div>

        <div className="mb-8">
          <RevenueChart
            entries={(orders ?? []).map((o) => ({ cents: o.total_cents ?? 0, createdAt: o.created_at }))}
            label="Kit Sales"
          />
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
            const isSubscription = items.some((i) => i.product_id === "subscription");

            return (
              <div key={order.id} className="bg-white rounded-xl border border-border p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {order.order_number && (
                        <span className="font-heading font-black text-base text-muted-foreground">K{order.order_number}</span>
                      )}
                      <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                      {isSubscription && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Subscription</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
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
                    <KitCustomerEditor
                      orderId={order.id}
                      name={order.customer_name ?? ""}
                      email={order.customer_email ?? ""}
                      phone={order.customer_phone ?? ""}
                      address={address}
                    />
                    {address && (
                      <ReturnLabelButton
                        orderId={order.id}
                        existingLabels={
                          Array.isArray((order as any).labels) && (order as any).labels.length > 0
                            ? (order as any).labels
                            : order.return_label_url
                              ? [{ labelUrl: order.return_label_url, trackingNumber: order.tracking_number ?? null, createdAt: "" }]
                              : []
                        }
                      />
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
