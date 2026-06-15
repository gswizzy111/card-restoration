import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { RevenueChart } from "./revenue-chart";
import { CardSearch } from "./card-search";
import { Suspense } from "react";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  regular:       { label: "Regular",       color: "bg-gray-100 text-gray-700" },
  expedited:     { label: "Expedited",     color: "bg-yellow-100 text-yellow-800" },
  premium:       { label: "Premium",       color: "bg-blue-100 text-blue-800" },
  ultra_premium: { label: "Ultra Premium", color: "bg-purple-100 text-purple-800" },
};

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600",
  awaiting_cards: "bg-yellow-100 text-yellow-700",
  received: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  shipped_back: "bg-cyan-100 text-cyan-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const admin = createAdminClient();

  // ── Card/name search mode ─────────────────────────────────────────────────
  if (query) {
    const [{ data: matchingCards }, { data: nameMatches }] = await Promise.all([
      admin.from("cards").select("order_id, card_name").ilike("card_name", `%${query}%`),
      admin
        .from("orders")
        .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at, restoration_tier")
        .or(`customer_name.ilike.%${query}%,customer_email.ilike.%${query}%`)
        .order("created_at", { ascending: false }),
    ]);

    const cardOrderIds = [...new Set((matchingCards ?? []).map((c) => c.order_id))];

    const { data: cardOrders } = cardOrderIds.length > 0
      ? await admin
          .from("orders")
          .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at, restoration_tier")
          .in("id", cardOrderIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    // Merge and deduplicate
    const seen = new Set<string>();
    const matchedOrders: typeof nameMatches = [];
    for (const o of [...(nameMatches ?? []), ...(cardOrders ?? [])]) {
      if (!seen.has(o.id)) { seen.add(o.id); matchedOrders.push(o); }
    }
    matchedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Map order_id → matching card names for display
    const hitsByOrder: Record<string, string[]> = {};
    for (const c of matchingCards ?? []) {
      if (!hitsByOrder[c.order_id]) hitsByOrder[c.order_id] = [];
      hitsByOrder[c.order_id].push(c.card_name);
    }

    return (
      <div className="min-h-screen bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h1 className="font-heading font-black text-3xl text-foreground">Orders</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {matchedOrders?.length ?? 0} order{matchedOrders?.length !== 1 ? "s" : ""} matching &ldquo;{query}&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Suspense>
                <CardSearch />
              </Suspense>
              <Link
                href="/admin/orders/new"
                className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center whitespace-nowrap"
              >
                + New Order
              </Link>
            </div>
          </div>

          {(!matchedOrders || matchedOrders.length === 0) ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
              No orders found matching &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {matchedOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                      </span>
                      {order.restoration_tier && TIER_BADGES[order.restoration_tier] && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_BADGES[order.restoration_tier].color}`}>
                          {TIER_BADGES[order.restoration_tier].label}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {hitsByOrder[order.id]?.length > 0 && (
                      <p className="text-sm text-primary font-semibold mt-1">
                        🃏 {hitsByOrder[order.id].join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1">
                    <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Default: all orders ───────────────────────────────────────────────────
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at, inbound_method, restoration_tier")
    .neq("status", "awaiting_payment")
    .order("created_at", { ascending: false });

  const { data: shopOrders } = await admin
    .from("shop_orders")
    .select("id, total_cents, created_at")
    .order("created_at", { ascending: false });

  const orderIds = orders?.map((o) => o.id) ?? [];
  const { data: allCards } = orderIds.length > 0
    ? await admin.from("cards").select("order_id, card_name").in("order_id", orderIds)
    : { data: [] };

  const cardsByOrder: Record<string, string[]> = {};
  for (const card of allCards ?? []) {
    if (!cardsByOrder[card.order_id]) cardsByOrder[card.order_id] = [];
    cardsByOrder[card.order_id].push(card.card_name);
  }

  const PAST_STATUSES = ["shipped_back", "delivered"];
  const activeOrders = (orders ?? []).filter((o) => !PAST_STATUSES.includes(o.status));
  const pastOrders = (orders ?? []).filter((o) => PAST_STATUSES.includes(o.status));

  const allRevenue = [
    ...(orders ?? []).map((o) => ({ total_cents: o.total_cents ?? 0, created_at: o.created_at })),
    ...(shopOrders ?? []).map((o) => ({ total_cents: o.total_cents ?? 0, created_at: o.created_at })),
  ];

  const now = new Date();
  const thisMonthRevenue = allRevenue.filter((o) => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonthRevenue.reduce((sum, o) => sum + o.total_cents, 0);
  const thisMonthOrderCount = thisMonthRevenue.length;
  const revenueEntries = allRevenue.map((o) => ({ cents: o.total_cents, createdAt: o.created_at }));

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="font-heading font-black text-3xl text-foreground">Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{allRevenue.length} total</p>
          </div>
          <div className="flex items-center gap-3">
            <Suspense>
              <CardSearch />
            </Suspense>
            <Link
              href="/admin/orders/new"
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center whitespace-nowrap"
            >
              + New Order
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Orders This Month</p>
            <p className="font-heading font-black text-3xl text-foreground">{thisMonthOrderCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue This Month</p>
            <p className="font-heading font-black text-3xl text-primary">{formatCurrency(monthRevenue)}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-8">
          <RevenueChart entries={revenueEntries} />
        </div>

        {/* Active orders */}
        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No active orders.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                    </span>
                    {order.restoration_tier && TIER_BADGES[order.restoration_tier] && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_BADGES[order.restoration_tier as RestorationTierId].color}`}>
                        {TIER_BADGES[order.restoration_tier as RestorationTierId].label}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                  {cardsByOrder[order.id]?.length > 0 && (
                    <p className="text-sm text-foreground font-medium mt-1">{cardsByOrder[order.id].join(", ")}</p>
                  )}
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1">
                  <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading font-black text-xl text-foreground mb-4">
              Past Orders
              <span className="ml-2 text-sm font-normal text-muted-foreground">({pastOrders.length})</span>
            </h2>
            <div className="flex flex-col gap-3">
              {pastOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors opacity-70 hover:opacity-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                      </span>
                      {order.restoration_tier && TIER_BADGES[order.restoration_tier] && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_BADGES[order.restoration_tier as RestorationTierId].color}`}>
                          {TIER_BADGES[order.restoration_tier as RestorationTierId].label}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {cardsByOrder[order.id]?.length > 0 && (
                      <p className="text-sm text-foreground font-medium mt-1">{cardsByOrder[order.id].join(", ")}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1">
                    <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
