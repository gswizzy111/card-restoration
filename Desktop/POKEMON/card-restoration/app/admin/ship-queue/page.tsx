import { createAdminClient } from "@/lib/supabase/admin";
import { ShipQueueStatusControl } from "./mark-shipped-button";
import { ReturnLabelButton as KitReturnLabelButton } from "../shop-orders/return-label-button";
import { ReturnLabelButton as RestorationReturnLabelButton } from "../orders/[id]/return-label-button";
import { AddressEditor } from "./address-editor";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ShippingAddress = {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

type OrderItem = {
  product_id?: string;
  product_name: string;
  quantity: number;
};

const TIER_LABELS: Record<string, string> = {
  regular:       "Bronze",
  expedited:     "Silver",
  premium:       "Gold",
  ultra_premium: "Platinum",
  elite:         "Diamond",
};
const TIER_COLORS: Record<string, string> = {
  regular:       "bg-amber-100 text-amber-700",
  expedited:     "bg-slate-100 text-slate-600",
  premium:       "bg-yellow-100 text-yellow-700",
  ultra_premium: "bg-blue-100 text-blue-600",
  elite:         "bg-cyan-100 text-cyan-700",
};

export default async function ShipQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "restoration" ? "restoration" : "kits";

  const admin = createAdminClient();
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [{ data: kitOrders }, { data: completedOrders }, { data: recentlyShippedKits }] = await Promise.all([
    admin
      .from("shop_orders")
      .select("id, customer_name, customer_email, customer_phone, shipping_address, items, created_at, status, return_label_url")
      .in("status", ["paid", "processing"])
      .is("return_label_url", null)
      .order("created_at", { ascending: true }),
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, customer_phone, restoration_tier, return_label_url, ship_from_address, created_at, cards(id, card_name, card_set, card_year, estimated_value_cents, completed)")
      .eq("status", "completed")
      .eq("payment_status", "paid")
      .is("return_label_url", null)
      .order("created_at", { ascending: true }),
    admin
      .from("shop_orders")
      .select("id, customer_name, customer_email, customer_phone, shipping_address, items, created_at, status, return_label_url")
      .eq("status", "shipped")
      .gte("updated_at", twoDaysAgo)
      .order("created_at", { ascending: true }),
  ]);

  const readyToShip = kitOrders ?? [];
  const restorationReady = completedOrders ?? [];
  const recentlyShipped = recentlyShippedKits ?? [];

  const kitsCount = readyToShip.length;
  const restorationCount = restorationReady.length;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-6">
          <h1 className="font-heading font-black text-3xl text-foreground">Ship Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {kitsCount + restorationCount} order{(kitsCount + restorationCount) !== 1 ? "s" : ""} need labels — oldest first
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-7 border-b border-border">
          <Link
            href="/admin/ship-queue"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "kits"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Kits
            {kitsCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === "kits" ? "bg-primary/10 text-primary" : "bg-primary text-white"
              }`}>
                {kitsCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/ship-queue?tab=restoration"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "restoration"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Restoration Orders
            {restorationCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === "restoration" ? "bg-green-100 text-green-700" : "bg-green-600 text-white"
              }`}>
                {restorationCount}
              </span>
            )}
          </Link>
        </div>

        {/* ── KITS TAB ── */}
        {activeTab === "kits" && (
          <>
            {readyToShip.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-16 text-center">
                <p className="text-2xl mb-2">📦</p>
                <p className="font-heading font-black text-lg text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No kit orders waiting to ship.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {readyToShip.map((order) => {
                  const addr = order.shipping_address as ShippingAddress | null;
                  const items = (order.items as OrderItem[] | null) ?? [];
                  const isSubscription = items.some((i) => i.product_id === "subscription");

                  return (
                    <div key={order.id} className="bg-white rounded-xl border border-border p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                            {isSubscription && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Subscription</span>
                            )}
                            {order.status === "processing" && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Processing</span>
                            )}
                            {order.status === "paid" && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground mb-2">
                            {items.length > 0 ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") : "—"}
                          </p>
                          <AddressEditor orderId={order.id} address={addr} />
                          <p className="text-xs text-muted-foreground mt-2">
                            Ordered {new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} EST
                          </p>
                          <div className="mt-3">
                            <KitReturnLabelButton
                              orderId={order.id}
                              existingLabels={
                                Array.isArray((order as any).labels) && (order as any).labels.length > 0
                                  ? (order as any).labels
                                  : order.return_label_url
                                    ? [{ labelUrl: order.return_label_url, trackingNumber: (order as any).tracking_number ?? null, createdAt: "" }]
                                    : []
                              }
                              labelName="Shipping"
                            />
                          </div>
                        </div>
                        <div className="shrink-0">
                          <ShipQueueStatusControl orderId={order.id} currentStatus={order.status} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recently shipped kits — last 48h */}
            {recentlyShipped.length > 0 && (
              <div className="mt-10">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Recently Shipped (last 48h)</p>
                <div className="flex flex-col gap-3">
                  {recentlyShipped.map((order) => {
                    const addr = order.shipping_address as ShippingAddress | null;
                    const items = (order.items as OrderItem[] | null) ?? [];
                    return (
                      <div key={order.id} className="bg-white rounded-xl border border-purple-200 p-5 opacity-80">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-heading font-black text-base text-foreground">{order.customer_name}</p>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Shipped</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {items.length > 0 ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") : "—"}
                            </p>
                            {addr && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {addr.street1}, {addr.city}, {addr.state} {addr.zip}
                              </p>
                            )}
                            <div className="mt-2">
                              <KitReturnLabelButton
                                orderId={order.id}
                                existingLabels={
                                  Array.isArray((order as any).labels) && (order as any).labels.length > 0
                                    ? (order as any).labels
                                    : order.return_label_url
                                      ? [{ labelUrl: order.return_label_url, trackingNumber: (order as any).tracking_number ?? null, createdAt: "" }]
                                      : []
                                }
                                labelName="Shipping"
                              />
                            </div>
                          </div>
                          <div className="shrink-0">
                            <ShipQueueStatusControl orderId={order.id} currentStatus={order.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── RESTORATION TAB ── */}
        {activeTab === "restoration" && (
          <>
            {restorationReady.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-16 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-heading font-black text-lg text-foreground">No cards ready to ship back</p>
                <p className="text-sm text-muted-foreground mt-1">Completed restoration orders will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {restorationReady.map((order) => {
                  const addr = order.ship_from_address as ShippingAddress | null;
                  const tier = order.restoration_tier as string | null;
                  const cards = ((order as any).cards ?? []) as {
                    id: string; card_name: string; card_set: string | null;
                    card_year: string | null; estimated_value_cents: number | null; completed: boolean;
                  }[];

                  return (
                    <div key={order.id} className="bg-white rounded-xl border-2 border-green-200 p-6">
                      <div className="flex flex-col gap-4">
                        {/* Header row */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Link href={`/admin/orders/${order.id}`} className="font-heading font-black text-lg text-foreground hover:text-primary transition-colors">
                                {order.customer_name}
                              </Link>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Ready to Ship</span>
                              {tier && TIER_LABELS[tier] && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[tier] ?? "bg-gray-100 text-gray-700"}`}>
                                  {TIER_LABELS[tier]}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                            <Link href={`/admin/orders/${order.id}`} className="text-xs font-mono text-primary hover:underline">
                              #{order.order_number}
                            </Link>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              Ordered {new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            {addr && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {addr.street1}{addr.street2 ? `, ${addr.street2}` : ""}<br />
                                {addr.city}, {addr.state} {addr.zip}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Cards list */}
                        {cards.length > 0 && (
                          <div className="border border-border rounded-lg overflow-hidden">
                            <div className="bg-secondary/50 px-3 py-1.5 flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Cards ({cards.length})
                              </p>
                              {cards.every(c => c.completed) && (
                                <span className="text-[10px] font-bold text-green-700 flex items-center gap-1">
                                  <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  All done
                                </span>
                              )}
                            </div>
                            <div className="divide-y divide-border">
                              {cards.map((card, i) => (
                                <div key={card.id} className={`flex items-center gap-3 px-3 py-2 ${card.completed ? "bg-green-50" : "bg-white"}`}>
                                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold truncate ${card.completed ? "text-green-700 line-through decoration-green-400" : "text-foreground"}`}>
                                      {card.card_name}
                                    </p>
                                    {(card.card_set || card.card_year) && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {[card.card_set, card.card_year].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                  {card.estimated_value_cents && (
                                    <p className="text-xs font-semibold text-muted-foreground shrink-0">
                                      ${(card.estimated_value_cents / 100).toFixed(0)}
                                    </p>
                                  )}
                                  {card.completed && (
                                    <svg viewBox="0 0 10 8" fill="none" className="w-3.5 h-3.5 text-green-600 shrink-0">
                                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Label button */}
                        <div>
                          <RestorationReturnLabelButton
                            orderId={order.id}
                            existingLabelUrl={(order as any).return_label_url ?? null}
                            insuranceType={null}
                            insuranceDeclaredValueCents={null}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
