import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type OrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  price_cents: number;
};

type ShopOrder = {
  id: string;
  items: OrderItem[];
  total_cents: number;
  created_at: string;
  status: string;
  customer_name: string;
};

export default async function AffiliateDashboard() {
  const jar = await cookies();
  const affiliateId = jar.get("affiliate_session")?.value;
  if (!affiliateId) redirect("/affiliates");

  const admin = createAdminClient();

  const { data: affiliate } = await admin
    .from("affiliates")
    .select("id, name, code")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) redirect("/affiliates");

  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, items, total_cents, created_at, status, customer_name")
    .eq("affiliate_code", affiliate.code)
    .order("created_at", { ascending: false });

  const allOrders: ShopOrder[] = orders ?? [];

  const totalOrders = allOrders.length;
  const totalKits = allOrders.reduce((sum, order) => {
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    return sum + items.reduce((s, item) => s + (item.quantity ?? 0), 0);
  }, 0);
  const earnings = totalKits * 10;

  function itemsSummary(items: OrderItem[]): string {
    if (!Array.isArray(items) || items.length === 0) return "—";
    return items
      .map((i) => `${i.product_name} ×${i.quantity}`)
      .join(", ");
  }

  function statusBadge(status: string) {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      shipped: "bg-blue-100 text-blue-800",
      delivered: "bg-purple-100 text-purple-800",
      refunded: "bg-red-100 text-red-800",
    };
    const cls = styles[status] ?? "bg-gray-100 text-gray-700";
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">{affiliate.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">Creator Dashboard — The Card Doc</p>
          </div>
          <form action="/api/affiliates/logout" method="POST">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign out
            </button>
          </form>
        </div>

        {/* Earnings banner */}
        <div className="bg-green-600 rounded-xl p-6 mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Total Earned</p>
          <p className="font-heading font-black text-4xl text-white">${earnings.toFixed(2)}</p>
          <p className="text-white/70 text-sm mt-1">
            {totalKits} kit{totalKits !== 1 ? "s" : ""} sold · {totalOrders} order{totalOrders !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Your Code card */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Your Creator Code</h2>
          <p className="text-xs text-muted-foreground mb-3">Share this at checkout to track your orders</p>
          <div className="bg-secondary/40 rounded-lg px-5 py-4 text-center">
            <span className="font-mono font-black text-3xl text-foreground tracking-widest">{affiliate.code}</span>
          </div>
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">Orders Using Your Code</h2>
          {totalOrders === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet using your code.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {allOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-bold text-foreground">{order.customer_name || "Customer"}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{itemsSummary(Array.isArray(order.items) ? order.items : [])}</p>
                    <p className="text-muted-foreground text-xs">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(order.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
