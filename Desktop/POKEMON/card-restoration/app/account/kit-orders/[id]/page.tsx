import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { LogoutButton } from "../../logout-button";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

const CARRIER_URLS: Record<string, (n: string) => string> = {
  USPS:  (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  UPS:   (n) => `https://www.ups.com/track?tracknum=${n}`,
  FedEx: (n) => `https://www.fedex.com/apps/fedextrack/?tracknumbers=${n}`,
  DHL:   (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
};

function getTrackUrl(carrier: string | null, tracking: string) {
  if (!carrier) return `https://parcelsapp.com/en/tracking/${tracking}`;
  const fn = CARRIER_URLS[carrier];
  return fn ? fn(tracking) : `https://parcelsapp.com/en/tracking/${tracking}`;
}

const STATUS_TIMELINE = ["paid", "processing", "shipped", "delivered"];
const STATUS_LABELS: Record<string, string> = {
  paid: "Order Received", processing: "Processing", shipped: "Shipped", delivered: "Delivered",
};
const STATUS_BADGE: Record<string, string> = {
  paid:       "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-emerald-100 text-emerald-700",
  cancelled:  "bg-red-100 text-red-700",
};

type ShopItem = { product_name: string; quantity: number; price_cents: number };

export default async function KitOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/account/login");

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) notFound();
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) notFound();

  const items = (order.items ?? []) as ShopItem[];
  const isSubscription = items.some((i: ShopItem) => i.product_name?.toLowerCase().includes("subscription"));
  const canCancel = !["cancelled", "delivered"].includes(order.status);

  const currentIdx = STATUS_TIMELINE.indexOf(order.status);
  const trackUrl = order.tracking_number
    ? getTrackUrl((order as any).carrier ?? null, order.tracking_number)
    : null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/account" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            ← My Orders
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Kit Order</p>
            <h1 className="font-heading font-black text-3xl text-foreground">
              {order.order_number ? `K${order.order_number}` : "Order"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Placed {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        {/* Status timeline */}
        {order.status !== "cancelled" && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-4">Status</h2>
            <div className="flex flex-col gap-3">
              {STATUS_TIMELINE.map((s) => {
                const sIdx = STATUS_TIMELINE.indexOf(s);
                const isDone = sIdx < currentIdx;
                const isCurrent = s === order.status;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs ${
                      isCurrent ? "bg-primary" : isDone ? "bg-primary/40" : "bg-border"
                    }`}>
                      {isDone && "✓"}
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-white block" />}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? "text-primary font-bold" : isDone ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                      {STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tracking */}
        {order.tracking_number && trackUrl && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-1">Shipment Tracking</p>
            {(order as any).carrier && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-200 text-cyan-800 mb-2 inline-block">{(order as any).carrier}</span>
            )}
            <p className="font-mono font-black text-lg text-cyan-900 tracking-widest mb-3 mt-1">{order.tracking_number}</p>
            <a
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-bold px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Track Package →
            </a>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">Order Summary</h2>
          <div className="flex flex-col gap-2 text-sm">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                <span className="font-medium">{formatCurrency(item.price_cents * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border mt-1 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Subscription cancel */}
        {isSubscription && canCancel && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h2 className="font-heading font-black text-lg text-foreground mb-2">Manage Subscription</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Want to cancel your subscription? Click below and we&apos;ll process it right away.
            </p>
            <CancelButton orderId={order.id} />
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Questions?{" "}
          <a href={`mailto:${process.env.CONTACT_EMAIL ?? "hello@thecarddoc.com"}`} className="text-primary font-medium hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
