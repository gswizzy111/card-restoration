import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/lib/constants";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600",
  awaiting_cards:   "bg-amber-100 text-amber-700",
  received:         "bg-blue-100 text-blue-700",
  in_progress:      "bg-purple-100 text-purple-700",
  completed:        "bg-green-100 text-green-700",
  shipped_back:     "bg-cyan-100 text-cyan-700",
  delivered:        "bg-emerald-100 text-emerald-700",
  cancelled:        "bg-red-100 text-red-700",
};

const KIT_STATUS_BADGE: Record<string, string> = {
  paid:       "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-emerald-100 text-emerald-700",
  cancelled:  "bg-red-100 text-red-700",
};

type ShopItem = { product_name: string; quantity: number };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/account/login");

  const email = user.email!;
  const admin = createAdminClient();

  const [restResult, kitResult] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, status, restoration_tier, total_cents, created_at, shipping_label_url, inbound_method")
      .ilike("customer_email", email)
      .not("status", "eq", "awaiting_payment")
      .order("created_at", { ascending: false }),
    admin
      .from("shop_orders")
      .select("id, order_number, status, total_cents, created_at, items, tracking_number, carrier")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false }),
  ]);

  const restorationOrders = restResult.data ?? [];
  const kitOrders = kitResult.data ?? [];

  const displayName = (user.user_metadata?.name as string | undefined) ?? email.split("@")[0];

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-heading font-black text-lg text-foreground hover:text-primary transition-colors">
              The Card Doc
            </Link>
            <span className="text-muted-foreground text-sm hidden sm:block">My Account</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Welcome back, {displayName}</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage your orders below.</p>
        </div>

        {/* Restoration Orders */}
        <section>
          <h2 className="font-heading font-black text-xl text-foreground mb-4">Restoration Orders</h2>
          {restorationOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
              No restoration orders found.{" "}
              <Link href="/order" className="text-primary font-semibold hover:underline">Place your first order →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {restorationOrders.map((order) => {
                const status = order.status as OrderStatus;
                const statusInfo = ORDER_STATUSES[status] ?? { label: order.status };
                const badgeCls = STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600";
                const orderLabel = /^\d+$/.test(String(order.order_number))
                  ? `R${order.order_number}`
                  : order.order_number;

                return (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.id}`}
                    className="bg-white rounded-xl border border-border p-5 hover:border-primary/40 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-black text-base">{orderLabel}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                          {statusInfo.label}
                        </span>
                        {order.status === "awaiting_cards" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            Edit cards ✏️
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {order.total_cents ? ` · ${formatCurrency(order.total_cents)}` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-sm shrink-0">View →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Kit Orders */}
        {kitOrders.length > 0 && (
          <section>
            <h2 className="font-heading font-black text-xl text-foreground mb-4">Kit Orders</h2>
            <div className="flex flex-col gap-3">
              {kitOrders.map((order) => {
                const items = (order.items ?? []) as ShopItem[];
                const badgeCls = KIT_STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600";
                const kitStatusLabels: Record<string, string> = { paid: "Processing", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
                const statusLabel = kitStatusLabels[order.status] ?? order.status;

                return (
                  <Link
                    key={order.id}
                    href={`/account/kit-orders/${order.id}`}
                    className="bg-white rounded-xl border border-border p-5 hover:border-primary/40 hover:shadow-sm transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.order_number && (
                          <span className="font-heading font-black text-base">K{order.order_number}</span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {order.total_cents ? ` · ${formatCurrency(order.total_cents)}` : ""}
                        {items.length > 0 ? ` · ${items.map((i) => i.product_name).join(", ")}` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-sm shrink-0">View →</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
