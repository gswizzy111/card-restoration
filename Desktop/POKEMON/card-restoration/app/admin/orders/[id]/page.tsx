import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { ORDER_STATUSES, STATUS_TIMELINE, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusUpdater } from "./status-updater";
import { PhotoUploader } from "./photo-uploader";
import { CompletionNotesEditor } from "./completion-notes-editor";
import { ReturnLabelButton } from "./return-label-button";
import { CheckpointAdder } from "./checkpoint-adder";
import { InboundTrackingEditor } from "./inbound-tracking-editor";
import type { Track } from "shippo/models/components";

export const dynamic = "force-dynamic";

function shippoCarrierToken(provider: string): string {
  const map: Record<string, string> = {
    USPS: "usps", FedEx: "fedex", UPS: "ups",
    DHLExpress: "dhl_express", "DHL Express": "dhl_express", DHL: "dhl",
  };
  return map[provider] ?? provider.toLowerCase().replace(/\s+/g, "_");
}

const TRACKING_BADGE: Record<string, { label: string; cls: string }> = {
  UNKNOWN:     { label: "Label Created",   cls: "bg-gray-100 text-gray-600" },
  PRE_TRANSIT: { label: "Label Created",   cls: "bg-gray-100 text-gray-600" },
  TRANSIT:     { label: "In Transit",      cls: "bg-blue-100 text-blue-700" },
  DELIVERED:   { label: "Delivered",       cls: "bg-green-100 text-green-700" },
  RETURNED:    { label: "Returned",        cls: "bg-orange-100 text-orange-700" },
  FAILURE:     { label: "Issue",           cls: "bg-red-100 text-red-700" },
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const [orderRes, { data: cards }, { data: services }, { data: events }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).single(),
    admin.from("cards").select("*").eq("order_id", id),
    admin.from("order_services").select("*").eq("order_id", id),
    admin.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);

  let order = orderRes.data;
  if (!order) notFound();

  // Auto-sync: if a return label was purchased but status wasn't updated to shipped_back,
  // fix it now (handles labels created before the auto-ship feature was added)
  if (
    order.return_label_url &&
    order.tracking_number &&
    !["shipped_back", "delivered", "cancelled"].includes(order.status)
  ) {
    await Promise.all([
      admin.from("orders").update({ status: "shipped_back" }).eq("id", id),
      admin.from("order_events").insert({
        order_id: id,
        event_type: "status_updated",
        description: `Marked Shipped Back — return label detected. Tracking: ${order.tracking_number}`,
        is_customer_visible: true,
      }),
    ]);
    order = { ...order, status: "shipped_back" };
  }

  // Live inbound tracking
  let inboundTrack: Track | null = null;
  if (order.inbound_tracking_number && order.inbound_carrier) {
    try {
      inboundTrack = await shippo.trackingStatus.get(
        order.inbound_tracking_number,
        shippoCarrierToken(order.inbound_carrier)
      );
    } catch { /* fail silently */ }
  }

  // Live return tracking (when shipped back)
  let returnTrack: Track | null = null;
  if (order.status === "shipped_back" && order.tracking_number) {
    try {
      returnTrack = await shippo.trackingStatus.get(order.tracking_number, "usps");
    } catch { /* fail silently */ }

    // Auto-advance to delivered if Shippo confirms delivery
    if (returnTrack?.trackingStatus?.status === "DELIVERED") {
      await Promise.all([
        admin.from("orders").update({ status: "delivered" }).eq("id", id),
        admin.from("order_events").insert({
          order_id: id,
          event_type: "status_updated",
          description: "Marked Delivered — USPS confirmed delivery of return package.",
          is_customer_visible: true,
        }),
      ]);
      order = { ...order, status: "delivered" };
    }
  }

  const address = order.ship_from_address as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← All Orders
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Header */}
            <div className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-heading font-black text-2xl text-foreground">Order #{order.order_number}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
                </div>
                <span className="font-heading font-black text-2xl text-primary">{formatCurrency(order.total_cents)}</span>
              </div>
            </div>

            {/* Status updater */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Order Status</h2>
              <StatusUpdater orderId={order.id} currentStatus={order.status} currentTrackingNumber={order.tracking_number as string | null} />
            </div>

            {/* Inbound tracking — only for buy_label orders */}
            {order.inbound_method === "buy_label" && (
              <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="font-heading font-black text-lg text-foreground mb-1">Inbound Tracking</h2>
                <p className="text-xs text-muted-foreground mb-4">The tracking number on the label the customer uses to ship their cards to you.</p>
                <InboundTrackingEditor
                  orderId={order.id}
                  currentTracking={order.inbound_tracking_number as string | null}
                />
              </div>
            )}

            {/* Completion notes + photos */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-1">Work Completion</h2>
              <p className="text-sm text-muted-foreground mb-5">Notes and photos from when the restoration is done. Photos are visible to the customer on their tracking page.</p>

              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Notes</p>
              <CompletionNotesEditor
                orderId={order.id}
                existingNotes={(order.admin_notes as string) ?? ""}
              />

              <div className="border-t border-border mt-6 pt-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Finished Photos</p>
                <PhotoUploader
                  orderId={order.id}
                  existingPhotos={(order.restoration_photos as string[]) ?? []}
                />
              </div>
            </div>

            {/* Cards */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">
                Cards ({cards?.length ?? 0})
              </h2>
              <div className="flex flex-col gap-4">
                {cards?.map((card, i) => (
                  <div key={card.id} className="p-4 rounded-lg bg-secondary/40 border border-border">
                    <p className="font-bold text-foreground">{i + 1}. {card.card_name}</p>
                    {card.card_set && <p className="text-sm text-muted-foreground">Set: {card.card_set}</p>}
                    {card.card_year && <p className="text-sm text-muted-foreground">Year: {card.card_year}</p>}
                    {card.card_number && <p className="text-sm text-muted-foreground">Card #: {card.card_number}</p>}
                    {card.estimated_value_cents && (
                      <p className="text-sm text-muted-foreground">Est. value: {formatCurrency(card.estimated_value_cents)}</p>
                    )}
                    {card.notes && <p className="text-sm text-muted-foreground mt-1">Notes: {card.notes}</p>}
                    {card.photo_urls?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {card.photo_urls.map((url: string, j: number) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Card photo" className="w-16 h-16 object-cover rounded border border-border" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Services</h2>
              <div className="flex flex-col gap-2">
                {services?.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{s.service_name} × {s.quantity}</span>
                    <span className="font-bold text-foreground">{formatCurrency(s.price_cents * s.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(order.total_cents)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:w-72 flex flex-col gap-5">

            {/* Customer info */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Customer</h2>
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-bold text-foreground">{order.customer_name}</p>
                <p className="text-muted-foreground">{order.customer_email}</p>
                <p className="text-muted-foreground">{order.customer_phone}</p>
                {address && (
                  <div className="mt-2 pt-2 border-t border-border text-muted-foreground">
                    <p>{address.street1}</p>
                    {address.street2 && <p>{address.street2}</p>}
                    <p>{address.city}, {address.state} {address.zip}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-3">Shipping</h2>
              <p className="text-sm text-foreground font-medium mb-3">
                {order.inbound_method === "buy_label" ? "Prepaid inbound label purchased" : "Customer shipping own way"}
              </p>
              {order.shipping_cents > 0 && (
                <p className="text-sm text-muted-foreground mb-3">Label cost: {formatCurrency(order.shipping_cents)}</p>
              )}
              {order.shipping_label_url && (
                <a
                  href={order.shipping_label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium text-primary hover:underline mb-3"
                >
                  Print Inbound Label (PDF)
                </a>
              )}

              {/* Live inbound tracking status */}
              {inboundTrack && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-1.5">Inbound Status</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    TRACKING_BADGE[inboundTrack.trackingStatus?.status ?? "UNKNOWN"]?.cls ?? "bg-gray-100 text-gray-600"
                  }`}>
                    {TRACKING_BADGE[inboundTrack.trackingStatus?.status ?? "UNKNOWN"]?.label ?? "Unknown"}
                  </span>
                  {inboundTrack.trackingStatus?.statusDetails && (
                    <p className="text-xs text-blue-800 mt-1.5">{inboundTrack.trackingStatus.statusDetails}</p>
                  )}
                  {inboundTrack.eta && (
                    <p className="text-xs font-semibold text-blue-900 mt-1">
                      ETA: {new Date(inboundTrack.eta).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric"
                      })}
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Return to Customer</p>
              <ReturnLabelButton
                orderId={order.id}
                existingLabelUrl={order.return_label_url}
                insuranceType={order.insurance_type}
                insuranceDeclaredValueCents={order.insurance_declared_value_cents}
              />

              {/* Live return tracking — shown once the return label is purchased */}
              {order.tracking_number && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Return Tracking #</p>
                  <p className="font-mono text-sm font-semibold text-foreground mb-2">{order.tracking_number}</p>
                  {returnTrack ? (
                    <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        TRACKING_BADGE[returnTrack.trackingStatus?.status ?? "UNKNOWN"]?.cls ?? "bg-gray-100 text-gray-600"
                      }`}>
                        {TRACKING_BADGE[returnTrack.trackingStatus?.status ?? "UNKNOWN"]?.label ?? "Unknown"}
                      </span>
                      {returnTrack.trackingStatus?.statusDetails && (
                        <p className="text-xs text-cyan-800 mt-1.5">{returnTrack.trackingStatus.statusDetails}</p>
                      )}
                      {returnTrack.eta && (
                        <p className="text-xs font-semibold text-cyan-900 mt-1">
                          ETA: {new Date(returnTrack.eta).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric"
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Tracking status unavailable</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {order.customer_notes && (
              <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="font-heading font-black text-lg text-foreground mb-3">Customer Notes</h2>
                <p className="text-sm text-muted-foreground">{order.customer_notes}</p>
              </div>
            )}

            {/* Event log */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Activity</h2>
              <div className="flex flex-col gap-3 mb-4">
                {events?.map((e) => (
                  <div key={e.id} className="text-sm border-l-2 border-border pl-3">
                    <p className="text-foreground">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
                      {e.is_customer_visible && (
                        <span className="text-xs text-green-600 font-medium">visible to customer</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <CheckpointAdder orderId={order.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
