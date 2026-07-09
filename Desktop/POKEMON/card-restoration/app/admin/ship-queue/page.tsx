import { createAdminClient } from "@/lib/supabase/admin";
import { ShipQueueStatusControl } from "./mark-shipped-button";
import { ReturnLabelButton } from "../shop-orders/return-label-button";
import { AddressEditor } from "./address-editor";

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
  product_id?: string;
  product_name: string;
  quantity: number;
};

export default async function ShipQueuePage() {
  const admin = createAdminClient();

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, customer_name, customer_email, customer_phone, shipping_address, items, created_at, status, return_label_url")
    .or(`status.in.(paid,processing),and(status.eq.shipped,updated_at.gte.${twoDaysAgo})`)
    .order("created_at", { ascending: true });

  const queue = orders ?? [];
  const readyToShip = queue.filter(o => o.status === "paid" || o.status === "processing");
  const recentlyShipped = queue.filter(o => o.status === "shipped");

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Ship Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {readyToShip.length} order{readyToShip.length !== 1 ? "s" : ""} waiting to ship — oldest first
          </p>
        </div>

        {readyToShip.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="text-2xl mb-2">📦</p>
            <p className="font-heading font-black text-lg text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No orders waiting to ship.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {readyToShip.map((order) => {
              const addr = order.shipping_address as ShippingAddress | null;
              const items = (order.items as OrderItem[] | null) ?? [];
              const isSubscription = items.some((i) => i.product_id === "subscription");

              return (
                <div key={order.id} className="bg-white rounded-xl border border-border p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <p className="font-heading font-black text-lg text-foreground">{order.customer_name}</p>
                        {isSubscription && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Subscription</span>
                        )}
                        {order.status === "processing" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Processing</span>
                        )}
                        {order.status === "paid" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mb-2">
                        {items.length > 0 ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") : "—"}
                      </p>
                      <AddressEditor orderId={order.id} address={addr} />
                      <p className="text-xs text-muted-foreground mt-2">
                        Ordered {new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} EST
                      </p>
                      <div className="mt-3">
                        <ReturnLabelButton
                          orderId={order.id}
                          existingLabelUrl={order.return_label_url ?? null}
                          labelName="Shipping"
                        />
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ShipQueueStatusControl orderId={order.id} currentStatus={order.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recently shipped — last 48 hours, with revert option */}
        {recentlyShipped.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Recently Shipped (last 48h)</p>
            <div className="flex flex-col gap-3">
              {recentlyShipped.map((order) => {
                const addr = order.shipping_address as ShippingAddress | null;
                const items = (order.items as OrderItem[] | null) ?? [];
                return (
                  <div key={order.id} className="bg-white rounded-xl border border-purple-200 p-5 opacity-80">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-heading font-black text-base text-foreground">{order.customer_name}</p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Shipped</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {items.length > 0 ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") : "—"}
                        </p>
                        {addr && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {addr.street1}, {addr.city}, {addr.state} {addr.zip}
                          </p>
                        )}
                        <div className="mt-2">
                          <ReturnLabelButton
                            orderId={order.id}
                            existingLabelUrl={order.return_label_url ?? null}
                            labelName="Shipping"
                          />
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ShipQueueStatusControl orderId={order.id} currentStatus={order.status} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
