import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { redirect, notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_TIMELINE } from "@/lib/constants";
import type { OrderStatus } from "@/lib/constants";
import Link from "next/link";
import { LogoutButton } from "../../logout-button";
import { CardEditor } from "./card-editor";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  awaiting_cards:  "bg-amber-100 text-amber-700",
  received:        "bg-blue-100 text-blue-700",
  in_progress:     "bg-purple-100 text-purple-700",
  completed:       "bg-green-100 text-green-700",
  shipped_back:    "bg-cyan-100 text-cyan-700",
  delivered:       "bg-emerald-100 text-emerald-700",
  cancelled:       "bg-red-100 text-red-700",
};

function shippoCarrierToken(carrier: string) {
  const map: Record<string, string> = {
    USPS: "usps", FedEx: "fedex", UPS: "ups", DHL: "dhl", DHLExpress: "dhl_express",
  };
  return map[carrier] ?? carrier.toLowerCase().replace(/\s+/g, "_");
}

export default async function AccountOrderPage({
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
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (!order) notFound();
  if (order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) notFound();

  const [cardsResult, servicesResult] = await Promise.all([
    admin.from("cards").select("*").eq("order_id", id).order("created_at"),
    admin.from("order_services").select("*").eq("order_id", id),
  ]);

  const cards = (cardsResult.data ?? []) as Array<{
    id: string;
    card_name: string;
    card_set: string | null;
    card_year: string | null;
    card_number: string | null;
    estimated_value_cents: number | null;
    notes: string | null;
    photo_urls: string[];
  }>;
  const services = servicesResult.data ?? [];

  // Check Shippo inbound tracking to determine lock status
  let locked = false;
  let lockReason: string | undefined;

  // Also show inbound tracking info while awaiting
  let inboundStatus: string | null = null;
  let inboundDetails: string | null = null;

  if (order.inbound_tracking_number) {
    try {
      const track = await shippo.trackingStatus.get(
        order.inbound_tracking_number,
        order.inbound_carrier ? shippoCarrierToken(order.inbound_carrier) : "usps"
      );
      const st = track.trackingStatus?.status ?? "UNKNOWN";
      inboundStatus = st;
      inboundDetails = track.trackingStatus?.statusDetails ?? null;

      if (["TRANSIT", "DELIVERED", "RETURNED", "FAILURE"].includes(st)) {
        locked = true;
        lockReason = "Your package has been picked up by the carrier and is on its way to us. Card details are now locked.";
      }
    } catch {
      // fail open
    }
  }

  // Also lock if order has moved past awaiting_cards
  if (!["awaiting_cards"].includes(order.status)) {
    locked = true;
    if (!lockReason) {
      lockReason = order.status === "received"
        ? "We've received your cards — editing is no longer available."
        : "This order is no longer editable.";
    }
  }

  const canEdit = !locked && order.status === "awaiting_cards";

  const orderLabel = /^\d+$/.test(String(order.order_number))
    ? `R${order.order_number}`
    : String(order.order_number);

  const visibleStatuses = STATUS_TIMELINE.filter((s) => s !== "awaiting_payment");
  const currentIndex = STATUS_TIMELINE.indexOf(order.status as OrderStatus);

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/account" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              ← My Orders
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
        {/* Order header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Restoration Order</p>
            <h1 className="font-heading font-black text-3xl text-foreground">{orderLabel}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Placed {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — status + tracking */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Status timeline */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-4">Status</h2>
              <div className="flex flex-col gap-3">
                {visibleStatuses.map((s) => {
                  const sIndex = STATUS_TIMELINE.indexOf(s);
                  const isDone = sIndex < currentIndex;
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
                        {ORDER_STATUSES[s]?.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inbound tracking */}
            {order.inbound_tracking_number && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-2">Inbound Tracking</p>
                {inboundStatus && (
                  <p className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2 ${
                    inboundStatus === "TRANSIT" ? "bg-blue-200 text-blue-800" :
                    inboundStatus === "DELIVERED" ? "bg-green-200 text-green-800" :
                    "bg-gray-200 text-gray-700"
                  }`}>
                    {inboundStatus === "TRANSIT" ? "In Transit" :
                     inboundStatus === "DELIVERED" ? "Delivered" :
                     inboundStatus === "UNKNOWN" || inboundStatus === "PRE_TRANSIT" ? "Label Created" :
                     inboundStatus}
                  </p>
                )}
                {inboundDetails && <p className="text-xs text-blue-800 mb-2">{inboundDetails}</p>}
                <p className="font-mono text-xs text-blue-600">{order.inbound_tracking_number}</p>
              </div>
            )}

            {/* Prepaid label download */}
            {order.inbound_method === "buy_label" && order.shipping_label_url && (
              <div className="bg-white rounded-xl border border-border p-5">
                <h2 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-3">Shipping Label</h2>
                <p className="text-xs text-muted-foreground mb-3">Print and attach to your package.</p>
                <a
                  href={order.shipping_label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Download Label (PDF)
                </a>
              </div>
            )}

            {/* Return tracking */}
            {order.tracking_number && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-1">Return Tracking</p>
                <p className="font-mono font-black text-base text-cyan-900 tracking-widest mb-3">{order.tracking_number}</p>
                <a
                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors inline-block"
                >
                  Track Package →
                </a>
              </div>
            )}

            {/* Order summary */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-3">Order Summary</h2>
              <div className="flex flex-col gap-2 text-sm">
                {services.map((s: any) => (
                  <div key={s.id} className="flex justify-between">
                    <span className="text-muted-foreground">{s.service_name} × {s.quantity}</span>
                    <span className="font-medium">{formatCurrency(s.price_cents * s.quantity)}</span>
                  </div>
                ))}
                {order.total_cents && (
                  <div className="border-t border-border mt-1 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(order.total_cents)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — cards */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Restoration results */}
            {(order.restoration_photos?.length > 0 || order.completion_notes) && (
              <div className="bg-white rounded-xl border border-border p-5">
                <h2 className="font-heading font-black text-lg text-foreground mb-4">Restoration Results</h2>
                {order.completion_notes && (
                  <div className="mb-4 p-4 bg-secondary/40 rounded-lg">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Notes from The Card Doc</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{order.completion_notes}</p>
                  </div>
                )}
                {order.restoration_photos?.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {(order.restoration_photos as string[]).map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Restored card" className="w-24 h-24 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card editor */}
            <div className="bg-white rounded-xl border border-border p-5">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">
                Your Cards ({cards.length})
              </h2>
              <CardEditor
                orderId={id}
                initialCards={cards}
                locked={locked}
                lockReason={lockReason}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
