import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { RevenueChart } from "./revenue-chart";

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

export default async function AdminPage() {
  const admin = createAdminClient();

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

  // Combined revenue entries from both tables
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

  // Build last 6 months of data for chart (both order types)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthItems = allRevenue.filter((o) => {
      const od = new Date(o.created_at);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });
    return {
      month: d.toLocaleString("default", { month: "short" }),
      revenue: Math.round(monthItems.reduce((s, o) => s + o.total_cents, 0)) / 100,
      orders: monthItems.length,
    };
  });

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{allRevenue.length} total</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/shop-orders" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Kit Orders →
            </Link>
            <Link href="/admin/products" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Products →
            </Link>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Analytics →
            </a>
            <form action="/api/admin/logout" method="POST">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
            </form>
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
          <RevenueChart data={monthlyData} />
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
                <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
