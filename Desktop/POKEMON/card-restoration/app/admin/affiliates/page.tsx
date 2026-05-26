import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { NewAffiliateForm } from "./new-affiliate-form";

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

type Affiliate = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export default async function AdminAffiliatesPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  const { data: affiliates } = await admin
    .from("affiliates")
    .select("*")
    .order("created_at", { ascending: false });

  const allAffiliates: Affiliate[] = affiliates ?? [];

  // Fetch all shop_orders that have any affiliate_code set
  const { data: allOrders } = await admin
    .from("shop_orders")
    .select("id, items, total_cents, created_at, status, customer_name, affiliate_code")
    .not("affiliate_code", "is", null)
    .order("created_at", { ascending: false });

  const ordersByCode: Record<string, ShopOrder[]> = {};
  for (const order of allOrders ?? []) {
    if (!order.affiliate_code) continue;
    const key = order.affiliate_code as string;
    if (!ordersByCode[key]) ordersByCode[key] = [];
    ordersByCode[key].push(order as ShopOrder);
  }

  function calcStats(code: string) {
    const orders = ordersByCode[code] ?? [];
    const totalOrders = orders.length;
    const totalKits = orders.reduce((sum, order) => {
      const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
      return sum + items.reduce((s, item) => s + (item.quantity ?? 0), 0);
    }, 0);
    const earnings = totalKits * 10;
    return { orders, totalOrders, totalKits, earnings };
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
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Affiliates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allAffiliates.length} creator code{allAffiliates.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <NewAffiliateForm />

      {allAffiliates.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No creator codes yet. Add one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {allAffiliates.map((affiliate) => {
            const { orders, totalOrders, totalKits, earnings } = calcStats(affiliate.code);

            return (
              <div key={affiliate.id} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Affiliate summary */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-heading font-black text-xl text-foreground">{affiliate.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(affiliate.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-mono font-black text-lg text-foreground tracking-widest">{affiliate.code}</p>
                      <p className="text-xs text-muted-foreground">code</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-foreground">{totalOrders}</p>
                      <p className="text-xs text-muted-foreground">orders</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-foreground">{totalKits}</p>
                      <p className="text-xs text-muted-foreground">kits</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-green-700">${earnings.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">earned</p>
                    </div>
                  </div>
                </div>

                {/* Recent orders */}
                {orders.length > 0 && (
                  <div className="border-t border-border px-6 py-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Recent Orders</p>
                    <div className="flex flex-col gap-2">
                      {orders.slice(0, 5).map((order) => {
                        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
                        const summary = items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") || "—";
                        return (
                          <div key={order.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-foreground">{order.customer_name || "Customer"}</span>
                              <span className="text-muted-foreground text-xs ml-2">{summary}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                              </span>
                              {statusBadge(order.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
