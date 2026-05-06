import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

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

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{allOrders.length} total</p>
          </div>
          <form action="/api/admin/logout" method="POST">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
          </form>
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
