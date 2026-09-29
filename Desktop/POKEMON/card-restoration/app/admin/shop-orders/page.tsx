import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { shippo } from "@/lib/shippo";
import { formatCurrency } from "@/lib/utils";
import Stripe from "stripe";
import Link from "next/link";
import { ReturnLabelButton } from "./return-label-button";
import { InternationalLabelButton } from "./international-label-button";
import { KitStatusUpdater } from "./status-updater";
import { KitCustomerEditor } from "./kit-customer-editor";
import { KitTrackingEditor } from "./kit-tracking-editor";
import { RevenueChart } from "../revenue-chart";
import { SyncKitOrdersButton } from "./sync-kit-orders-button";
import { SyncShopDeliveredButton } from "./sync-shop-delivered-button";

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
  size?: string | null;
};

type ShippingAddress = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

function detectCarrier(trackingNumber: string): string {
  if (/^1Z/i.test(trackingNumber)) return "ups";
  if (/^\d{12}$|^\d{15}$/.test(trackingNumber)) return "fedex";
  return "usps";
}

// Fast auto-sync: only checks the 15 most recent Stripe sessions (single API call).
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

function OrderCard({ order }: { order: Record<string, any> }) {
  const address = order.shipping_address as ShippingAddress | null;
  const items = (order.items ?? []) as ShopOrderItem[];
  const isSubscription = items.some((i) => i.product_id === "subscription");
  const isInternational = address?.country && address.country !== "US";

  return (
    <div className="bg-white rounded-xl border border-border p-6">
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
            {isInternational && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🌍 {address?.country}</span>
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
          {address && !isInternational && (
            <ReturnLabelButton
              orderId={order.id}
              existingLabels={
                Array.isArray(order.labels) && order.labels.length > 0
                  ? order.labels
                  : order.return_label_url
                    ? [{ labelUrl: order.return_label_url, trackingNumber: order.tracking_number ?? null, createdAt: "" }]
                    : []
              }
            />
          )}
          {address && isInternational && (
            <InternationalLabelButton
              orderId={order.id}
              existingLabels={
                Array.isArray(order.international_labels) && order.international_labels.length > 0
                  ? order.international_labels
                  : order.return_label_url
                    ? [{ label_url: order.return_label_url, customs_url: null, tracking_number: order.tracking_number ?? null, tracking_url: null, created_at: "" }]
                    : []
              }
              orderValueCents={order.total_cents ?? 0}
            />
          )}
          <KitTrackingEditor
            orderId={order.id}
            initialTracking={order.tracking_number ?? null}
            initialCarrier={order.carrier ?? null}
          />
        </div>
      </div>
    </div>
  );
}

export default async function ShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "not-scanned" ? "not-scanned" : "all";

  const admin = createAdminClient();
  await syncRecentFromStripe();

  const { data: orders } = await admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false });

  // For "not-scanned" tab: check Shippo tracking on recently-shipped orders
  type NotScannedRow = { order: Record<string, any>; daysSince: number; labelCreatedAt: string | null };
  let notScanned: NotScannedRow[] = [];

  if (activeTab === "not-scanned") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Orders with a label and status "shipped", within last 30 days
    const candidates = (orders ?? []).filter((o) => {
      const tracking = o.tracking_number ?? (Array.isArray(o.labels) && o.labels.length > 0 ? o.labels[0]?.trackingNumber : null);
      return tracking && o.status === "shipped" && new Date(o.created_at) > cutoff;
    });

    // Check Shippo tracking in parallel (cap at 20 to keep load fast)
    const toCheck = candidates.slice(0, 20);
    const results = await Promise.allSettled(
      toCheck.map(async (order) => {
        const tracking = order.tracking_number ??
          (Array.isArray(order.labels) ? order.labels[0]?.trackingNumber : null);
        const carrier = detectCarrier(tracking ?? "");
        try {
          const track = await shippo.trackingStatus.get(tracking, carrier);
          const status = track.trackingStatus?.status ?? "UNKNOWN";
          return { order, status };
        } catch {
          // If tracking call fails, assume not yet scanned
          return { order, status: "UNKNOWN" };
        }
      })
    );

    notScanned = results
      .filter((r) => r.status === "fulfilled" &&
        ["PRE_TRANSIT", "UNKNOWN"].includes((r as PromiseFulfilledResult<any>).value.status))
      .map((r) => {
        const { order } = (r as PromiseFulfilledResult<any>).value;
        const labels = Array.isArray(order.labels) ? order.labels : [];
        const labelCreatedAt = labels[0]?.createdAt || null;
        const daysSince = labelCreatedAt
          ? Math.floor((Date.now() - new Date(labelCreatedAt).getTime()) / 86400000)
          : Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);
        return { order, daysSince, labelCreatedAt };
      })
      .sort((a, b) => b.daysSince - a.daysSince); // oldest first — most urgent
  }

  const tabs = [
    { id: "all", label: "All Orders", href: "/admin/shop-orders" },
    { id: "not-scanned", label: "Not Picked Up", href: "/admin/shop-orders?tab=not-scanned" },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Kit Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{orders?.length ?? 0} total</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncShopDeliveredButton />
            <SyncKitOrdersButton />
            <Link href="/admin/shop-orders/new" className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
              + New Order
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/60 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === t.id
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {activeTab === "all" && (
          <>
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
              {orders?.map((order) => <OrderCard key={order.id} order={order as any} />)}
            </div>
          </>
        )}

        {activeTab === "not-scanned" && (
          <div className="flex flex-col gap-4">
            {notScanned.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-12 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold text-foreground">All labels have been scanned by the carrier</p>
                <p className="text-sm text-muted-foreground mt-1">No recently shipped orders are stuck in pre-transit.</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-amber-900 font-medium">
                    {notScanned.length} label{notScanned.length !== 1 ? "s" : ""} created but not yet scanned by the carrier. Reprint and hand to carrier if needed.
                  </p>
                </div>
                {notScanned.map(({ order, daysSince, labelCreatedAt }) => {
                  const address = order.shipping_address as ShippingAddress | null;
                  const labels = Array.isArray(order.labels) ? order.labels : [];
                  const tracking = order.tracking_number ?? labels[0]?.trackingNumber ?? null;
                  const labelUrl = labels[0]?.labelUrl ?? order.return_label_url ?? null;

                  return (
                    <div key={order.id} className={`bg-white rounded-xl border p-5 ${daysSince >= 3 ? "border-amber-300" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {order.order_number && (
                              <span className="font-heading font-black text-sm text-muted-foreground">K{order.order_number}</span>
                            )}
                            <p className="font-heading font-black text-base text-foreground">{order.customer_name}</p>
                            {daysSince >= 3 && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                {daysSince}d since label created
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                        </div>
                        <Link
                          href={`/admin/shop-orders`}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          View order →
                        </Link>
                      </div>

                      {/* Items ordered */}
                      {(() => {
                        const items = (order.items ?? []) as ShopOrderItem[];
                        return items.length > 0 ? (
                          <div className="mb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Items to Pack</p>
                            <div className="flex flex-col gap-0.5">
                              {items.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <span className="font-bold text-foreground w-5 text-center">{item.quantity}×</span>
                                  <span className="text-foreground">{item.product_name}</span>
                                  {item.size && <span className="text-xs text-muted-foreground">({item.size})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Tracking + address */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tracking #</p>
                          {tracking ? (
                            <p className="font-mono font-semibold text-foreground">{tracking}</p>
                          ) : (
                            <p className="text-muted-foreground italic">No tracking number</p>
                          )}
                          {labelCreatedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Label created {new Date(labelCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ship To</p>
                          {address ? (
                            <p className="text-foreground">
                              {address.street1}{address.street2 ? `, ${address.street2}` : ""}<br />
                              {address.city}, {address.state} {address.zip}
                            </p>
                          ) : (
                            <p className="text-muted-foreground italic">No address on file</p>
                          )}
                        </div>
                      </div>

                      {/* Reprint button */}
                      {labelUrl && (
                        <ReturnLabelButton
                          orderId={order.id}
                          existingLabels={labels.length > 0 ? labels : [{ labelUrl, trackingNumber: tracking, createdAt: "" }]}
                          labelName="Shipping"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
