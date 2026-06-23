import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  received:    { label: "Cards Received", cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress",    cls: "bg-purple-100 text-purple-700" },
};

const TIER_STYLES: Record<string, { label: string; cls: string }> = {
  regular:       { label: "Regular",       cls: "bg-gray-100 text-gray-700" },
  expedited:     { label: "Expedited",     cls: "bg-blue-100 text-blue-700" },
  premium:       { label: "Premium",       cls: "bg-purple-100 text-purple-700" },
  ultra_premium: { label: "Ultra Premium", cls: "bg-yellow-100 text-yellow-700" },
};

function daysAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default async function FulfillmentQueuePage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, created_at, status, restoration_tier, total_cents")
    .in("status", ["received", "in_progress"])
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true });

  // Get card counts per order
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: cardCounts } = orderIds.length > 0
    ? await admin
        .from("cards")
        .select("order_id")
        .in("order_id", orderIds)
    : { data: [] };

  const countByOrder: Record<string, number> = {};
  for (const row of cardCounts ?? []) {
    countByOrder[row.order_id] = (countByOrder[row.order_id] ?? 0) + 1;
  }

  const received   = (orders ?? []).filter((o) => o.status === "received");
  const inProgress = (orders ?? []).filter((o) => o.status === "in_progress");

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Fulfillment Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cards in your hands that need to be worked on — sorted oldest first
          </p>
        </div>

        {(!orders || orders.length === 0) ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-heading font-black text-lg text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No orders are waiting to be fulfilled.</p>
          </div>
        ) : (
          <>
            {/* Needs to be started */}
            <Section
              title="Needs to be Started"
              count={received.length}
              countCls="bg-blue-100 text-blue-700"
              orders={received}
              countByOrder={countByOrder}
              emptyMsg="No orders waiting to be started."
            />

            {/* In Progress */}
            <Section
              title="In Progress"
              count={inProgress.length}
              countCls="bg-purple-100 text-purple-700"
              orders={inProgress}
              countByOrder={countByOrder}
              emptyMsg="No orders currently in progress."
            />
          </>
        )}
      </div>
    </div>
  );
}

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  status: string;
  restoration_tier: string | null;
  total_cents: number;
};

function Section({
  title,
  count,
  countCls,
  orders,
  countByOrder,
  emptyMsg,
}: {
  title: string;
  count: number;
  countCls: string;
  orders: Order[];
  countByOrder: Record<string, number>;
  emptyMsg: string;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-heading font-black text-xl text-foreground">{title}</h2>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${countCls}`}>
          {count} order{count !== 1 ? "s" : ""}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          {emptyMsg}
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
                <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Days Waiting</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const tier = order.restoration_tier as RestorationTierId | null;
                const tierStyle = tier ? TIER_STYLES[tier] : null;
                const statusStyle = STATUS_STYLES[order.status];
                const days = daysAgo(order.created_at);
                const cards = countByOrder[order.id] ?? 0;

                return (
                  <tr
                    key={order.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${
                      days >= 7 ? "bg-red-50/40" : days >= 4 ? "bg-yellow-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono font-bold text-primary hover:underline"
                      >
                        #{order.order_number}
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
                      <span className={`font-bold text-sm ${
                        days >= 7 ? "text-red-600" : days >= 4 ? "text-yellow-600" : "text-foreground"
                      }`}>
                        {days}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {statusStyle && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusStyle.cls}`}>
                          {statusStyle.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
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
    </div>
  );
}
