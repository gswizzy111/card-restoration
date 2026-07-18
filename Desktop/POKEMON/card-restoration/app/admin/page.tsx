import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { RevenueChart } from "./revenue-chart";
import { CardSearch } from "./card-search";
import { Suspense } from "react";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import type { Track } from "shippo/models/components";
import { SyncTrackingButton } from "./sync-tracking-button";
import { SyncDeliveredButton } from "./sync-delivered-button";

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  regular:       { label: "Regular",       color: "bg-gray-100 text-gray-700" },
  expedited:     { label: "Expedited",     color: "bg-yellow-100 text-yellow-800" },
  premium:       { label: "Premium",       color: "bg-blue-100 text-blue-800" },
  ultra_premium: { label: "Ultra Premium", color: "bg-purple-100 text-purple-800" },
};

const TIER_STYLES: Record<string, { label: string; cls: string }> = {
  regular:       { label: "Regular",       cls: "bg-gray-100 text-gray-700" },
  expedited:     { label: "Expedited",     cls: "bg-yellow-100 text-yellow-800" },
  premium:       { label: "Premium",       cls: "bg-blue-100 text-blue-800" },
  ultra_premium: { label: "Ultra Premium", cls: "bg-purple-100 text-purple-800" },
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

const FULFILLMENT_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  received:    { label: "Cards Received", cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress",    cls: "bg-purple-100 text-purple-700" },
};

function businessDaysSince(dateStr: string): number {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = Math.abs(days);
  const dir = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    result.setDate(result.getDate() + dir);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

function businessDaysUntil(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  if (now.getTime() === t.getTime()) return 0;
  const overdue = t < now;
  const from = overdue ? new Date(t) : new Date(now);
  const to = overdue ? new Date(now) : new Date(t);
  let count = 0;
  const d = new Date(from);
  while (d < to) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return overdue ? -count : count;
}

const TIER_TURNAROUND_DAYS: Record<string, number> = {
  regular:       20,
  expedited:     15,
  premium:       8,
  ultra_premium: 5,
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; tier?: string; period?: string }>;
}) {
  const { q, tab, tier: tierFilter, period: shippedPeriod } = await searchParams;
  const query = q?.trim() ?? "";
  const activeTab = tab === "fulfillment" ? "fulfillment" : tab === "shipped" ? "shipped" : tab === "awaiting" ? "awaiting" : "orders";
  const activePeriod = shippedPeriod === "week" ? "week" : shippedPeriod === "month" ? "month" : shippedPeriod === "all" ? "all" : "today";

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

    const seen = new Set<string>();
    const matchedOrders: typeof nameMatches = [];
    for (const o of [...(nameMatches ?? []), ...(cardOrders ?? [])]) {
      if (!seen.has(o.id)) { seen.add(o.id); matchedOrders.push(o); }
    }
    matchedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
                      <span className="font-heading font-black text-foreground">{/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}</span>
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

  // ── Fetch data for all tabs in parallel ───────────────────────────────────
  const [
    { data: orders },
    { data: shopOrders },
    { data: fulfillmentOrders },
    { data: shippedRaw },
    { data: awaitingOrders },
  ] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, created_at, inbound_method, restoration_tier")
      .neq("status", "awaiting_payment")
      .order("created_at", { ascending: false }),
    admin
      .from("shop_orders")
      .select("id, total_cents, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, created_at, status, restoration_tier, total_cents")
      .in("status", ["received", "in_progress"])
      .eq("payment_status", "paid")
      .order("created_at", { ascending: true }),
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, created_at, updated_at, tracking_number, return_label_url, admin_notes")
      .eq("status", "shipped_back")
      .order("updated_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, created_at, total_cents, restoration_tier, inbound_method")
      .eq("status", "awaiting_cards")
      .eq("payment_status", "paid")
      .order("created_at", { ascending: true }),
  ]);

  // Query Shippo live tracking for shipped orders that have a tracking number
  type ShippedWithTracking = typeof shippedRaw extends (infer T)[] | null ? T & { track: Track | null } : never;
  let shippedOrders: ShippedWithTracking[] = [];
  if (activeTab === "shipped" && shippedRaw && shippedRaw.length > 0) {
    const results = await Promise.allSettled(
      shippedRaw.map(async (o) => {
        let track: Track | null = null;
        if (o.tracking_number) {
          try {
            track = await shippo.trackingStatus.get(o.tracking_number, "usps");
          } catch { /* fail silently per order */ }
        }
        return { ...o, track };
      })
    );
    shippedOrders = results
      .filter((r): r is PromiseFulfilledResult<ShippedWithTracking> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  // Date-filter shipped orders by when they were updated (shipped out)
  function filterByPeriod<T extends { updated_at: string }>(list: T[], period: string): T[] {
    const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const todayStart = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate());
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
    const monthStart = new Date(nowET.getFullYear(), nowET.getMonth(), 1);
    return list.filter((o) => {
      const d = new Date(o.updated_at);
      if (period === "today") return d >= todayStart;
      if (period === "week") return d >= weekStart;
      if (period === "month") return d >= monthStart;
      return true;
    });
  }
  const filteredShippedOrders = filterByPeriod(shippedOrders, activePeriod);

  const orderIds = orders?.map((o) => o.id) ?? [];
  const { data: allCards } = orderIds.length > 0
    ? await admin.from("cards").select("order_id, card_name, photo_urls").in("order_id", orderIds)
    : { data: [] };

  const cardsByOrder: Record<string, string[]> = {};
  const photosByOrder: Record<string, string[]> = {};
  for (const card of allCards ?? []) {
    if (!cardsByOrder[card.order_id]) cardsByOrder[card.order_id] = [];
    cardsByOrder[card.order_id].push(card.card_name);
    const urls: string[] = Array.isArray(card.photo_urls) ? card.photo_urls : [];
    if (urls.length > 0) {
      if (!photosByOrder[card.order_id]) photosByOrder[card.order_id] = [];
      photosByOrder[card.order_id].push(...urls);
    }
  }

  // Cards for awaiting queue (names + photos)
  const awaitingIds = (awaitingOrders ?? []).map((o) => o.id);
  const { data: awaitingCards } = awaitingIds.length > 0
    ? await admin.from("cards").select("order_id, card_name, photo_urls").in("order_id", awaitingIds)
    : { data: [] };

  const awaitingCardsByOrder: Record<string, { name: string; photos: string[] }[]> = {};
  for (const card of awaitingCards ?? []) {
    if (!awaitingCardsByOrder[card.order_id]) awaitingCardsByOrder[card.order_id] = [];
    awaitingCardsByOrder[card.order_id].push({
      name: card.card_name,
      photos: Array.isArray(card.photo_urls) ? card.photo_urls : [],
    });
  }

  // Card counts for fulfillment queue
  const fulfillmentIds = (fulfillmentOrders ?? []).map((o) => o.id);
  const { data: fulfillmentCards } = fulfillmentIds.length > 0
    ? await admin.from("cards").select("order_id").in("order_id", fulfillmentIds)
    : { data: [] };

  const cardCountByOrder: Record<string, number> = {};
  for (const row of fulfillmentCards ?? []) {
    cardCountByOrder[row.order_id] = (cardCountByOrder[row.order_id] ?? 0) + 1;
  }

  // Find when each fulfillment order was marked received (for accurate "days since received")
  const { data: receivedEvents } = fulfillmentIds.length > 0
    ? await admin.from("order_events")
        .select("order_id, created_at")
        .in("order_id", fulfillmentIds)
        .like("description", "%Cards Received%")
        .order("created_at", { ascending: true })
    : { data: [] };

  const receivedAtByOrder: Record<string, string> = {};
  for (const ev of receivedEvents ?? []) {
    if (!receivedAtByOrder[ev.order_id]) receivedAtByOrder[ev.order_id] = ev.created_at;
  }

  // Sort fulfillment orders by business-day due date (most urgent first)
  const sortedFulfillmentOrders = [...(fulfillmentOrders ?? [])].sort((a, b) => {
    const recA = receivedAtByOrder[a.id] ?? a.created_at;
    const recB = receivedAtByOrder[b.id] ?? b.created_at;
    const daysA = TIER_TURNAROUND_DAYS[(a.restoration_tier as string) ?? "regular"] ?? 20;
    const daysB = TIER_TURNAROUND_DAYS[(b.restoration_tier as string) ?? "regular"] ?? 20;
    const dueA = addBusinessDays(new Date(recA), daysA).getTime();
    const dueB = addBusinessDays(new Date(recB), daysB).getTime();
    return dueA - dueB;
  }).filter((o) => !tierFilter || tierFilter === "all" || o.restoration_tier === tierFilter);

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
  const kitRevenueEntries = (shopOrders ?? []).map((o) => ({ cents: o.total_cents ?? 0, createdAt: o.created_at }));

  const fulfillmentCount = fulfillmentOrders?.length ?? 0;
  const shippedCount = shippedRaw?.length ?? 0;
  const awaitingCount = awaitingOrders?.length ?? 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="font-heading font-black text-3xl text-foreground">
              {activeTab === "fulfillment" ? "Fulfillment Queue" : "Orders"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {activeTab === "fulfillment"
                ? "Cards in your hands — sorted oldest first"
                : `${allRevenue.length} total`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "orders" && (
              <Suspense>
                <CardSearch />
              </Suspense>
            )}
            <Link
              href="/admin/orders/new"
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center whitespace-nowrap"
            >
              + New Order
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-7 border-b border-border">
          <Link
            href="/admin"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors ${
              activeTab === "orders"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Orders
          </Link>
          <Link
            href="/admin?tab=awaiting"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "awaiting"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Awaiting Cards
            {awaitingCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === "awaiting" ? "bg-orange-100 text-orange-700" : "bg-orange-500 text-white"
              }`}>
                {awaitingCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin?tab=fulfillment"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "fulfillment"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Fulfillment Queue
            {fulfillmentCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === "fulfillment" ? "bg-primary/10 text-primary" : "bg-primary text-white"
              }`}>
                {fulfillmentCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin?tab=shipped"
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === "shipped"
                ? "bg-white border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Shipped Out
            {shippedCount > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === "shipped" ? "bg-cyan-100 text-cyan-700" : "bg-cyan-600 text-white"
              }`}>
                {shippedCount}
              </span>
            )}
          </Link>
        </div>

        {/* ── ORDERS TAB ── */}
        {activeTab === "orders" && (
          <>
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

            {/* Charts */}
            <div className="mb-8 flex flex-col gap-6">
              <RevenueChart entries={revenueEntries} label="Total Revenue" />
              <RevenueChart entries={kitRevenueEntries} label="Kit Sales" />
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
                        <span className="font-heading font-black text-foreground">{/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}</span>
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
                      {photosByOrder[order.id]?.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {photosByOrder[order.id].slice(0, 5).map((url, i) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={i} src={url} alt="Card" className="w-12 h-12 object-cover rounded-lg border border-border" />
                          ))}
                          {photosByOrder[order.id].length > 5 && (
                            <div className="w-12 h-12 rounded-lg border border-border bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                              +{photosByOrder[order.id].length - 5}
                            </div>
                          )}
                        </div>
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
                          <span className="font-heading font-black text-foreground">{/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}</span>
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
                        {photosByOrder[order.id]?.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {photosByOrder[order.id].slice(0, 5).map((url, i) => (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img key={i} src={url} alt="Card" className="w-12 h-12 object-cover rounded-lg border border-border" />
                            ))}
                            {photosByOrder[order.id].length > 5 && (
                              <div className="w-12 h-12 rounded-lg border border-border bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                +{photosByOrder[order.id].length - 5}
                              </div>
                            )}
                          </div>
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
          </>
        )}

        {/* ── AWAITING CARDS TAB ── */}
        {activeTab === "awaiting" && (() => {
          function ageBadge(createdAt: string) {
            const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
            let cls: string;
            if (days <= 3)       cls = "bg-green-100 text-green-700";
            else if (days <= 7)  cls = "bg-yellow-100 text-yellow-800";
            else if (days <= 14) cls = "bg-orange-100 text-orange-700";
            else                 cls = "bg-red-100 text-red-700";
            return { days, cls };
          }

          return awaitingCount === 0 ? (
            <div className="bg-white rounded-xl border border-border p-16 text-center">
              <p className="text-2xl mb-2">📬</p>
              <p className="font-heading font-black text-lg text-foreground">All cards received!</p>
              <p className="text-sm text-muted-foreground mt-1">No orders are waiting for cards to arrive.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(awaitingOrders ?? []).map((order) => {
                const { days, cls } = ageBadge(order.created_at);
                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-heading font-black text-foreground">{/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}</span>
                        {order.restoration_tier && TIER_BADGES[order.restoration_tier] && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_BADGES[order.restoration_tier as RestorationTierId].color}`}>
                            {TIER_BADGES[order.restoration_tier as RestorationTierId].label}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground mb-3">{order.customer_email}</p>
                      {(awaitingCardsByOrder[order.id] ?? []).map((card, i) => (
                        <div key={i} className="flex items-center gap-3 mb-2">
                          {card.photos[0] && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={card.photos[0]} alt={card.name} className="w-12 h-12 object-cover rounded-lg border border-border flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-foreground">{card.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:pt-0.5">
                      <span className={`text-xs font-black px-3 py-1.5 rounded-full ${cls}`}>
                        {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
                      </span>
                      <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}

        {/* ── FULFILLMENT TAB ── */}
        {activeTab === "fulfillment" && (
          <>
            {/* Tier filter */}
            <div className="flex gap-2 flex-wrap mb-3">
              {[["all", "All Tiers"], ["ultra_premium", "Ultra Premium"], ["premium", "Premium"], ["expedited", "Expedited"], ["regular", "Regular"]].map(([val, label]) => (
                <Link
                  key={val}
                  href={`/admin?tab=fulfillment&tier=${val}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                    (tierFilter ?? "all") === val
                      ? "bg-foreground text-background border-foreground"
                      : "bg-white text-muted-foreground border-border hover:border-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            {fulfillmentCount === 0 ? (
              <div className="bg-white rounded-xl border border-border p-16 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-heading font-black text-lg text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No orders are waiting to be fulfilled.</p>
              </div>
            ) : sortedFulfillmentOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
                No {tierFilter && tierFilter !== "all" ? TIER_STYLES[tierFilter]?.label : ""} orders in queue.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Tier</th>
                      <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Cards</th>
                      <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Biz Days In</th>
                      <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Biz Days Left</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFulfillmentOrders.map((order) => {
                      const tier = (order.restoration_tier as RestorationTierId | null) ?? "regular";
                      const tierStyle = TIER_STYLES[tier] ?? null;
                      const statusStyle = FULFILLMENT_STATUS_STYLES[order.status];
                      const receivedAt = receivedAtByOrder[order.id] ?? null;
                      const bizDaysIn = receivedAt ? businessDaysSince(receivedAt) : null;
                      const turnaround = TIER_TURNAROUND_DAYS[tier] ?? 20;
                      const dueDate = receivedAt ? addBusinessDays(new Date(receivedAt), turnaround) : null;
                      const daysUntilDue = dueDate ? businessDaysUntil(dueDate) : null;
                      const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                      const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 2;
                      const cards = cardCountByOrder[order.id] ?? 0;

                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${
                            isOverdue ? "bg-red-50/50" : isDueSoon ? "bg-yellow-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <Link href={`/admin/orders/${order.id}`} className="font-mono font-bold text-primary hover:underline">
                              {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {tierStyle ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierStyle.cls}`}>
                                {tierStyle.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-foreground">{cards}</td>
                          <td className="px-4 py-3 text-center">
                            {bizDaysIn !== null
                              ? <span className="font-bold text-sm text-foreground">{bizDaysIn}d</span>
                              : <span className="text-xs text-muted-foreground">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            {daysUntilDue !== null
                              ? <span className={`font-black text-sm ${isOverdue ? "text-red-600" : isDueSoon ? "text-yellow-600" : "text-green-600"}`}>
                                  {isOverdue ? `${Math.abs(daysUntilDue)}d over` : `${daysUntilDue}d`}
                                </span>
                              : <span className="text-xs text-muted-foreground">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            {statusStyle && (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyle.cls}`}>
                                {statusStyle.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/orders/${order.id}`} className="text-xs font-bold text-primary hover:underline">
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SHIPPED OUT TAB ── */}
        {activeTab === "shipped" && (() => {
          const missingTracking = shippedOrders.filter((o) => !o.tracking_number);
          const SHIP_BADGE: Record<string, { label: string; cls: string }> = {
            UNKNOWN:     { label: "Waiting to be Shipped Out", cls: "bg-gray-100 text-gray-700" },
            PRE_TRANSIT: { label: "Waiting to be Shipped Out", cls: "bg-gray-100 text-gray-700" },
            TRANSIT:     { label: "Out for Delivery",           cls: "bg-blue-100 text-blue-700" },
            DELIVERED:   { label: "Delivered",                  cls: "bg-green-100 text-green-700" },
            RETURNED:    { label: "Being Returned",             cls: "bg-orange-100 text-orange-700" },
            FAILURE:     { label: "Delivery Issue",             cls: "bg-red-100 text-red-700" },
          };
          const PERIOD_FILTERS = [
            { value: "today", label: "Today" },
            { value: "week",  label: "This Week" },
            { value: "month", label: "This Month" },
            { value: "all",   label: "All Time" },
          ];
          return (
            <>
              {/* Sync delivered — always shown on shipped tab */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-bold text-emerald-800 text-sm">Sync delivered status</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Checks every shipped order against USPS via Shippo and marks any confirmed deliveries as Delivered.
                  </p>
                </div>
                <SyncDeliveredButton />
              </div>

              {/* Sync banner — shown when there are orders with no tracking number */}
              {missingTracking.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-yellow-800 text-sm">
                      {missingTracking.length} order{missingTracking.length !== 1 ? "s" : ""} missing tracking numbers
                    </p>
                    <p className="text-xs text-yellow-700 mt-0.5">
                      Click to pull tracking numbers from Shippo automatically. Orders with no Shippo label will need manual entry.
                    </p>
                  </div>
                  <SyncTrackingButton />
                </div>
              )}

              {/* Period filter pills */}
              <div className="flex gap-2 flex-wrap mb-4 items-center">
                {PERIOD_FILTERS.map(({ value, label }) => (
                  <Link
                    key={value}
                    href={`/admin?tab=shipped&period=${value}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                      activePeriod === value
                        ? "bg-foreground text-background border-foreground"
                        : "bg-white text-muted-foreground border-border hover:border-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <span className="text-xs text-muted-foreground ml-1">
                  {filteredShippedOrders.length} order{filteredShippedOrders.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-red-500 font-semibold ml-1 flex items-center gap-1">
                  <span className="text-red-500 font-black">*</span> = grader notes missing
                </span>
              </div>

              {shippedCount === 0 ? (
                <div className="bg-white rounded-xl border border-border p-16 text-center">
                  <p className="text-2xl mb-2">📦</p>
                  <p className="font-heading font-black text-lg text-foreground">No packages out</p>
                  <p className="text-sm text-muted-foreground mt-1">No orders have been shipped yet.</p>
                </div>
              ) : filteredShippedOrders.length === 0 ? (
                <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
                  No shipped orders for this time period.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Customer</th>
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Shipped</th>
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Tracking #</th>
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Details</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShippedOrders.map((order) => {
                        const hasTracking = !!order.tracking_number;
                        const missingNotes = !order.admin_notes || (order.admin_notes as string).trim() === "";
                        const trackStatus = order.track?.trackingStatus?.status ?? "UNKNOWN";
                        const statusDetails = order.track?.trackingStatus?.statusDetails ?? null;
                        const eta = order.track?.eta ?? null;
                        const badge = hasTracking
                          ? (SHIP_BADGE[trackStatus] ?? SHIP_BADGE.UNKNOWN)
                          : { label: "No Tracking Number", cls: "bg-red-100 text-red-700" };

                        return (
                          <tr key={order.id} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${!hasTracking ? "bg-red-50/30" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Link href={`/admin/orders/${order.id}`} className="font-mono font-bold text-primary hover:underline">
                                  {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                                </Link>
                                {missingNotes && (
                                  <span className="text-red-500 font-black text-base leading-none" title="Grader notes missing">*</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{order.customer_name}</p>
                              <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(order.updated_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-3">
                              {hasTracking
                                ? <p className="font-mono text-xs text-foreground">{order.tracking_number}</p>
                                : <p className="text-xs text-red-500 font-medium">Missing</p>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              {statusDetails && (
                                <p className="text-xs text-muted-foreground truncate">{statusDetails}</p>
                              )}
                              {eta && (
                                <p className="text-xs font-semibold text-foreground mt-0.5">
                                  ETA: {new Date(eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/admin/orders/${order.id}`} className="text-xs font-bold text-primary hover:underline">
                                View →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}

      </div>
    </div>
  );
}
