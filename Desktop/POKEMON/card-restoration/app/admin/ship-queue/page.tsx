import { createAdminClient } from "@/lib/supabase/admin";
import { MarkShippedButton } from "./mark-shipped-button";

export const dynamic = "force-dynamic";

type ShippingAddress = {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

type OrderItem = {
  product_name: string;
  quantity: number;
};

export default async function ShipQueuePage() {
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, customer_name, customer_email, customer_phone, shipping_address, items, created_at, status")
    .in("status", ["paid", "processing"])
    .order("created_at", { ascending: true });

  const queue = orders ?? [];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Ship Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {queue.length} order{queue.length !== 1 ? "s" : ""} waiting to ship — oldest first
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="text-2xl mb-2">📦</p>
            <p className="font-heading font-black text-lg text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No orders waiting to ship.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {queue.map((order) => {
              const addr = order.shipping_address as ShippingAddress | null;
              const items = (order.items as OrderItem[] | null) ?? [];

              return (
                <div key={order.id} className="bg-white rounded-xl border border-border p-6 flex flex-col sm:flex-row sm:items-center gap-5">

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                      {order.status === "processing" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Processing</span>
                      )}
                      {order.status === "paid" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                      )}
                    </div>

                    {/* Items */}
                    <p className="text-sm font-medium text-foreground mb-2">
                      {items.length > 0
                        ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")
                        : "—"}
                    </p>

                    {/* Address */}
                    {addr ? (
                      <div className="text-sm text-muted-foreground">
                        <p>{addr.street1}{addr.street2 ? `, ${addr.street2}` : ""}</p>
                        <p>{addr.city}, {addr.state} {addr.zip}{addr.country && addr.country !== "US" ? ` · ${addr.country}` : ""}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No address on file</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Ordered {new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} EST
                    </p>
                  </div>

                  {/* Action */}
                  <MarkShippedButton orderId={order.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
