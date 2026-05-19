import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { SyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  paid:      "bg-blue-100 text-blue-700",
  shipped:   "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-700",
};

type ShopOrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  price_cents: number;
};

type ShippingAddress = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export default async function ShopOrdersPage() {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Kit Orders</h1>
            <p className="text-muted-foreground text-sm mt-1">{orders?.length ?? 0} total</p>
          </div>
          <div className="flex items-center gap-4">
            <SyncButton />
            <Link href="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Restoration Orders →
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
            </form>
          </div>
        </div>

        {(!orders || orders.length === 0) && (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No kit orders yet.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {orders?.map((order) => {
            const address = order.shipping_address as ShippingAddress | null;
            const items = (order.items ?? []) as ShopOrderItem[];

            return (
              <div key={order.id} className="bg-white rounded-xl border border-border p-6">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border pt-5">
                  {/* Items */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Items Ordered</p>
                    <div className="flex flex-col gap-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.product_name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                          <span className="font-medium text-foreground">{formatCurrency(item.price_cents * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm text-muted-foreground pt-1 border-t border-border mt-1">
                        <span>Shipping</span>
                        <span>{formatCurrency(order.shipping_cents ?? 599)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Shipping address */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Ship To</p>
                    {address ? (
                      <div className="text-sm text-foreground leading-relaxed">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-muted-foreground">{address.street1}{address.street2 ? `, ${address.street2}` : ""}</p>
                        <p className="text-muted-foreground">{address.city}, {address.state} {address.zip}</p>
                        <p className="text-muted-foreground">{address.country}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No address on file</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
