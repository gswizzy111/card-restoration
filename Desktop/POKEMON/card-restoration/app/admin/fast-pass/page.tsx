import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600",
  awaiting_cards:   "bg-yellow-100 text-yellow-700",
  received:         "bg-blue-100 text-blue-700",
  in_progress:      "bg-purple-100 text-purple-700",
  completed:        "bg-green-100 text-green-700",
  shipped_back:     "bg-cyan-100 text-cyan-700",
  delivered:        "bg-emerald-100 text-emerald-700",
  cancelled:        "bg-red-100 text-red-700",
};

const TURNAROUND_DAYS = 5;

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
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) remaining--;
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
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return overdue ? -count : count;
}

export default async function FastPassPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, status, payment_status, created_at, restoration_tier, shipping_label_url, inbound_method, admin_notes, insurance_declared_value_cents")
    .eq("restoration_tier", "fast_pass")
    .order("created_at", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: allCards } = orderIds.length > 0
    ? await admin.from("cards").select("order_id, card_name, photo_urls, completed").in("order_id", orderIds)
    : { data: [] };

  // Find received-at for in-progress orders
  const { data: receivedEvents } = orderIds.length > 0
    ? await admin.from("order_events")
        .select("order_id, created_at")
        .in("order_id", orderIds)
        .like("description", "%Cards Received%")
        .order("created_at", { ascending: true })
    : { data: [] };
  const receivedAtByOrder: Record<string, string> = {};
  for (const ev of receivedEvents ?? []) {
    if (!receivedAtByOrder[ev.order_id]) receivedAtByOrder[ev.order_id] = ev.created_at;
  }

  const cardsByOrder: Record<string, { name: string; photo: string | null; completed: boolean }[]> = {};
  for (const card of allCards ?? []) {
    if (!cardsByOrder[card.order_id]) cardsByOrder[card.order_id] = [];
    const photos: string[] = Array.isArray(card.photo_urls) ? card.photo_urls : [];
    cardsByOrder[card.order_id].push({ name: card.card_name, photo: photos[0] ?? null, completed: card.completed ?? false });
  }

  const PAST = ["shipped_back", "delivered", "cancelled"];
  const ACTIVE_STATUSES = ["awaiting_cards", "received", "in_progress", "completed", "awaiting_payment"];

  const all = orders ?? [];
  const activeOrders = all.filter((o) => !PAST.includes(o.status));
  const pastOrders = all.filter((o) => PAST.includes(o.status));

  const filtered = (statusFilter && statusFilter !== "all")
    ? activeOrders.filter((o) => o.status === statusFilter)
    : activeOrders;

  // Sort active by urgency (days left ascending, or overdue first)
  const sorted = [...filtered].sort((a, b) => {
    const recA = receivedAtByOrder[a.id] ?? null;
    const recB = receivedAtByOrder[b.id] ?? null;
    if (!recA && !recB) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (!recA) return 1;
    if (!recB) return -1;
    const dueA = addBusinessDays(new Date(recA), TURNAROUND_DAYS).getTime();
    const dueB = addBusinessDays(new Date(recB), TURNAROUND_DAYS).getTime();
    return dueA - dueB;
  });

  const totalRevenue = all.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const activeCount = activeOrders.filter((o) => o.payment_status === "paid").length;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-heading font-black text-3xl text-foreground">Fast Pass Orders</h1>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
                {TURNAROUND_DAYS}-day turnaround
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{all.length} total · {activeCount} active paid</p>
          </div>
          <Link href="/admin/orders/new" className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center whitespace-nowrap">
            + New Order
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Orders</p>
            <p className="font-heading font-black text-3xl text-foreground">{all.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Active</p>
            <p className="font-heading font-black text-3xl text-orange-600">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">In Progress</p>
            <p className="font-heading font-black text-3xl text-purple-600">
              {all.filter((o) => o.status === "in_progress").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue</p>
            <p className="font-heading font-black text-3xl text-primary">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            ["all", "All Active"],
            ["awaiting_payment", "Awaiting Payment"],
            ["awaiting_cards", "Awaiting Cards"],
            ["received", "Received"],
            ["in_progress", "In Progress"],
            ["completed", "Completed"],
          ].map(([val, label]) => (
            <Link
              key={val}
              href={`/admin/fast-pass${val !== "all" ? `?status=${val}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                (statusFilter ?? "all") === val
                  ? "bg-foreground text-background border-foreground"
                  : "bg-white text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Active orders */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="text-3xl mb-2">⚡</p>
            <p className="font-heading font-black text-lg text-foreground">No fast pass orders</p>
            <p className="text-sm text-muted-foreground mt-1">Fast pass orders will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden mb-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Order</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Cards</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Progress</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Biz Days In</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Days Left</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => {
                  const cards = cardsByOrder[order.id] ?? [];
                  const done = cards.filter((c) => c.completed).length;
                  const receivedAt = receivedAtByOrder[order.id] ?? null;
                  const bizDaysIn = receivedAt ? businessDaysSince(receivedAt) : null;
                  const dueDate = receivedAt ? addBusinessDays(new Date(receivedAt), TURNAROUND_DAYS) : null;
                  const daysUntilDue = dueDate ? businessDaysUntil(dueDate) : null;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 1;
                  const allDone = cards.length > 0 && done === cards.length;

                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${
                        isOverdue ? "bg-red-50/50" : isDueSoon ? "bg-yellow-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`/admin/orders/${order.id}`} className="font-mono font-bold text-primary hover:underline text-sm">
                            {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="flex flex-col gap-1">
                          {cards.slice(0, 3).map((card, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {card.photo && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={card.photo} alt={card.name} className="w-8 h-8 object-cover rounded border border-border shrink-0" />
                              )}
                              <span className={`text-xs truncate ${card.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {card.name}
                              </span>
                            </div>
                          ))}
                          {cards.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{cards.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-sm ${allDone ? "text-green-600" : done > 0 ? "text-yellow-600" : "text-foreground"}`}>
                          {done}/{cards.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bizDaysIn !== null
                          ? <span className={`font-bold text-sm ${bizDaysIn >= TURNAROUND_DAYS ? "text-red-600" : "text-foreground"}`}>{bizDaysIn}d</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {daysUntilDue !== null
                          ? <span className={`font-black text-sm ${isOverdue ? "text-red-600" : isDueSoon ? "text-yellow-600" : "text-green-600"}`}>
                              {isOverdue ? `${Math.abs(daysUntilDue)}d over` : `${daysUntilDue}d`}
                            </span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                          </span>
                          {order.payment_status !== "paid" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 inline-block">
                              Unpaid
                            </span>
                          )}
                          {(order.insurance_declared_value_cents ?? 0) > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-block">
                              Insured ${((order.insurance_declared_value_cents ?? 0) / 100).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-heading font-black text-primary">{formatCurrency(order.total_cents)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/orders/${order.id}`} className="text-xs font-bold text-primary hover:underline whitespace-nowrap">
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

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <>
            <h2 className="font-heading font-black text-xl text-foreground mb-4">
              Past Orders <span className="text-sm font-normal text-muted-foreground">({pastOrders.length})</span>
            </h2>
            <div className="flex flex-col gap-3">
              {pastOrders.map((order) => {
                const cards = cardsByOrder[order.id] ?? [];
                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors opacity-70 hover:opacity-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-heading font-black text-foreground">
                          {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                      {cards.length > 0 && (
                        <p className="text-sm text-foreground font-medium mt-1">{cards.map((c) => c.name).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1 shrink-0">
                      <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
