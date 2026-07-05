import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { CreateKitOrderButton } from "./create-kit-order-button";

export const dynamic = "force-dynamic";

type Subscription = {
  id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: {
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    country?: string;
  } | null;
  status: string;
  created_at: string;
  cancelled_at: string | null;
};

type SubOrderItem = { product_id: string; product_name: string; quantity: number; price_cents: number };

type SubShopOrder = {
  id: string;
  customer_email: string;
  status: string;
  created_at: string;
  items: SubOrderItem[] | null;
};

export default async function AdminSubscriptionsPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  const [{ data }, { data: allShopOrders }] = await Promise.all([
    admin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    admin.from("shop_orders").select("id, customer_email, status, created_at, items").order("created_at", { ascending: false }),
  ]);

  const subscriptions: Subscription[] = (data ?? []) as Subscription[];
  const activeCount = subscriptions.filter((s) => s.status === "active").length;

  // Build per-email map of subscription-generated shop orders
  const subShopOrders = ((allShopOrders ?? []) as SubShopOrder[]).filter((o) => {
    const items = o.items ?? [];
    return items.some((i) => i.product_id === "subscription");
  });

  const ordersByEmail: Record<string, SubShopOrder[]> = {};
  for (const o of subShopOrders) {
    if (!ordersByEmail[o.customer_email]) ordersByEmail[o.customer_email] = [];
    ordersByEmail[o.customer_email].push(o);
  }

  function formatAddress(addr: Subscription["shipping_address"]): string {
    if (!addr) return "—";
    return [addr.street1, addr.street2, `${addr.city}, ${addr.state} ${addr.zip}`].filter(Boolean).join(", ");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  // Total pending kits across all active subs
  const pendingKitCount = Object.values(ordersByEmail).flat().filter(
    (o) => ["paid", "processing"].includes(o.status)
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} active subscriber{activeCount !== 1 ? "s" : ""} — Monthly Kit Club
          </p>
        </div>
        {pendingKitCount > 0 && (
          <Link
            href="/admin/ship-queue"
            className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <span className="bg-white text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black">
              {pendingKitCount}
            </span>
            Kit{pendingKitCount !== 1 ? "s" : ""} pending shipment →
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <p className="font-heading font-black text-4xl text-primary">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Total All Time</p>
          <p className="font-heading font-black text-4xl text-foreground">{subscriptions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Kits Sent Total</p>
          <p className="font-heading font-black text-4xl text-foreground">{subShopOrders.length}</p>
        </div>
      </div>

      {/* Plan info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-purple-700 text-lg">📦</span>
        </div>
        <div>
          <p className="font-bold text-purple-900 text-sm">Monthly Kit Club</p>
          <p className="text-xs text-purple-700 mt-0.5">
            Every active subscriber receives one full kit per month — billed at $62.99/mo recurring via Stripe.
            Monthly kits appear in the <Link href="/admin/ship-queue" className="underline font-semibold">Ship Queue</Link> and <Link href="/admin/shop-orders" className="underline font-semibold">Kit Orders</Link> automatically when Stripe bills them.
          </p>
        </div>
      </div>

      {/* List */}
      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No subscriptions yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {subscriptions.map((sub) => {
            const myOrders = ordersByEmail[sub.customer_email] ?? [];
            const pendingOrders = myOrders.filter((o) => ["paid", "processing"].includes(o.status));
            const shippedCount = myOrders.filter((o) => ["shipped", "delivered"].includes(o.status)).length;
            const lastOrder = myOrders[0];

            return (
              <div
                key={sub.id}
                className={`bg-white rounded-xl border p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${
                  pendingOrders.length > 0 ? "border-orange-300" : "border-border"
                }`}
              >
                {/* Left — customer info */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-black text-lg text-foreground leading-none">
                      {sub.customer_name}
                    </p>
                    {sub.status === "active" ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Cancelled
                      </span>
                    )}
                    {pendingOrders.length > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Kit pending shipment
                      </span>
                    )}
                  </div>

                  {/* Plan */}
                  <p className="text-xs font-bold text-purple-700 mt-0.5">Monthly Kit Club — $62.99/mo</p>

                  <p className="text-sm text-muted-foreground">{sub.customer_email}</p>
                  {sub.customer_phone && (
                    <p className="text-sm text-muted-foreground">{sub.customer_phone}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatAddress(sub.shipping_address)}
                  </p>

                  {/* Kit stats */}
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{myOrders.length}</span> kit order{myOrders.length !== 1 ? "s" : ""} on record
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{shippedCount}</span> shipped/delivered
                    </span>
                    {lastOrder && (
                      <span className="text-xs text-muted-foreground">Last: {formatDate(lastOrder.created_at)}</span>
                    )}
                    {myOrders.length === 0 && sub.status === "active" && (
                      <span className="text-xs font-bold text-red-600">No kit orders found — create one below</span>
                    )}
                  </div>
                </div>

                {/* Right — dates */}
                <div className="flex flex-col gap-1 text-sm text-right shrink-0">
                  <p className="text-muted-foreground">
                    Joined{" "}
                    <span className="text-foreground font-medium">{formatDate(sub.created_at)}</span>
                  </p>
                  {sub.cancelled_at && (
                    <p className="text-muted-foreground">
                      Cancelled{" "}
                      <span className="text-foreground font-medium">{formatDate(sub.cancelled_at)}</span>
                    </p>
                  )}
                  {pendingOrders.length > 0 && (
                    <Link
                      href="/admin/ship-queue"
                      className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 underline"
                    >
                      Ship kit →
                    </Link>
                  )}
                  {pendingOrders.length === 0 && sub.status === "active" && (
                    <div className="mt-2">
                      <CreateKitOrderButton subscriptionId={sub.id} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
