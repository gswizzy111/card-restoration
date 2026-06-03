import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { RevenueChart } from "./revenue-chart";
import { CardSearch } from "./card-search";
import { Suspense } from "react";

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

  // ── Card search mode ──────────────────────────────────────────────────────
  if (query) {
    const { data: matchingCards } = await admin
      .from("cards")
      .select("order_id, card_name")
      .ilike("card_name", `%${query}%`);

    const orderIds = [...new Set((matchingCards ?? []).map((c) => c.order_id))];

    const { data: matchedOrders } = orderIds.length > 0
      ? await admin
          .from("orders")
          .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at")
          .in("id", orderIds)
          .order("created_at", { ascending: false })
      : { data: [] };

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
                {matchedOrders?.length ?? 0} order{matchedOrders?.length !== 1 ? "s" : ""} containing &ldquo;{query}&rdquo;
              </p>
            </div>
            <Suspense>
              <CardSearch />
            </Suspense>
          </div>

          {(!matchedOrders || matchedOrders.length === 0) ? (
            <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
              No orders found with a card matching &ldquo;{query}&rdquo;.
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
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                      </span>
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
    .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at, inbound_method")
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

  const allOrders = orders ?? [];

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
          <Suspense>
            <CardSearch />
          </Suspense>
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

        {allOrders.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No orders yet.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {allOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                  </span>
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
      </div>
    </div>
  );
}
