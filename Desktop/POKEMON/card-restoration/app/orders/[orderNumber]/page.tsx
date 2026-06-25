import { createAdminClient } from "@/lib/supabase/admin";
import { shippo } from "@/lib/shippo";
import { ORDER_STATUSES, STATUS_TIMELINE, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Track } from "shippo/models/components";
import { UpgradeSection } from "./upgrade-section";
import type { RestorationTierId } from "@/lib/restoration-tiers";

function shippoCarrierToken(provider: string): string {
  const map: Record<string, string> = {
    USPS: "usps",
    FedEx: "fedex",
    UPS: "ups",
    DHLExpress: "dhl_express",
    "DHL Express": "dhl_express",
    DHL: "dhl",
    Canada: "canadapost",
    CanadaPost: "canadapost",
  };
  return map[provider] ?? provider.toLowerCase().replace(/\s+/g, "_");
}

const TRACKING_BADGE: Record<string, { label: string; cls: string }> = {
  UNKNOWN:     { label: "Label Created",  cls: "bg-gray-100 text-gray-700" },
  PRE_TRANSIT: { label: "Label Created",  cls: "bg-gray-100 text-gray-700" },
  TRANSIT:     { label: "In Transit",     cls: "bg-blue-100 text-blue-700" },
  DELIVERED:   { label: "Delivered",      cls: "bg-green-100 text-green-700" },
  RETURNED:    { label: "Returned",       cls: "bg-orange-100 text-orange-700" },
  FAILURE:     { label: "Delivery Issue", cls: "bg-red-100 text-red-700" },
};

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .single();

  if (!order) notFound();

  const { data: cards } = await admin.from("cards").select("*").eq("order_id", order.id);
  const { data: services } = await admin.from("order_services").select("*").eq("order_id", order.id);

  // Fetch live inbound tracking from Shippo (only while awaiting cards)
  let inboundTrack: Track | null = null;
  if (
    order.inbound_tracking_number &&
    order.inbound_carrier &&
    (order.status === "awaiting_cards" || order.status === "received")
  ) {
    try {
      inboundTrack = await shippo.trackingStatus.get(
        order.inbound_tracking_number,
        shippoCarrierToken(order.inbound_carrier)
      );
    } catch {
      // fail silently — don't break the page
    }
  }

  const currentIndex = STATUS_TIMELINE.indexOf(order.status as OrderStatus);
  const visibleStatuses = STATUS_TIMELINE.filter(s => s !== "awaiting_payment");

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Order Tracking</p>
        <h1 className="font-heading font-black text-3xl text-foreground">Order #{order.order_number}</h1>
        <p className="text-muted-foreground text-sm mt-1">Placed {new Date(order.created_at).toLocaleDateString()}</p>
      </div>

      {/* Status timeline */}
      <div className="bg-white rounded-xl border border-border p-6 mb-5">
        <h2 className="font-heading font-black text-lg text-foreground mb-5">Status</h2>
        <div className="flex flex-col gap-3">
          {visibleStatuses.map((s) => {
            const sIndex = STATUS_TIMELINE.indexOf(s);
            const isDone = sIndex < currentIndex;
            const isCurrent = s === order.status;
            return (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                  isCurrent ? "bg-primary" : isDone ? "bg-primary/30" : "bg-border"
                }`}>
                  {isDone && <span className="text-white text-xs">✓</span>}
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-white block" />}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? "text-primary font-bold" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {ORDER_STATUSES[s]?.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade section — only while awaiting cards */}
      {order.status === "awaiting_cards" && (
        <UpgradeSection
          orderNumber={order.order_number}
          customerEmail={order.customer_email}
          currentTier={(order.restoration_tier as RestorationTierId | null)}
          currentSubtotalCents={order.subtotal_cents ?? 0}
          cardCount={cards?.length ?? 1}
        />
      )}

      {/* Live inbound tracking (while we're waiting for the cards) */}
      {inboundTrack && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-3">Inbound Shipment Tracking</p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              TRACKING_BADGE[inboundTrack.trackingStatus?.status ?? "UNKNOWN"]?.cls ?? "bg-gray-100 text-gray-700"
            }`}>
              {TRACKING_BADGE[inboundTrack.trackingStatus?.status ?? "UNKNOWN"]?.label ?? "Unknown"}
            </span>
          </div>
          {inboundTrack.trackingStatus?.statusDetails && (
            <p className="text-sm text-blue-800 mb-2">{inboundTrack.trackingStatus.statusDetails}</p>
          )}
          {inboundTrack.eta && (
            <p className="text-sm font-semibold text-blue-900">
              Estimated arrival: {new Date(inboundTrack.eta).toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric"
              })}
            </p>
          )}
          <p className="font-mono text-xs text-blue-600 mt-3">{order.inbound_tracking_number}</p>
        </div>
      )}

      {/* Return tracking number */}
      {order.tracking_number && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-6 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-700 mb-1">Return Tracking</p>
          <p className="font-mono font-black text-xl text-cyan-900 tracking-widest mb-3">{order.tracking_number}</p>
          <a
            href={`https://www.17track.net/en/track?nums=${order.tracking_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-bold px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Track Package →
          </a>
        </div>
      )}

      {/* Prepaid shipping label */}
      {order.inbound_method === "buy_label" && order.shipping_label_url && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-5">
          <h2 className="font-heading font-black text-lg text-blue-900 mb-2">Your Prepaid Shipping Label</h2>
          <p className="text-sm text-blue-800 mb-4">Print this label, attach it to your package, and drop it off at the carrier.</p>
          <a
            href={order.shipping_label_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Download Label (PDF)
          </a>
        </div>
      )}

      {/* Restoration photos & notes */}
      {(order.restoration_photos?.length > 0 || order.completion_notes) && (
        <div className="bg-white rounded-xl border border-border p-6 mb-5">
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
                  <img src={url} alt="Restored card" className="w-28 h-28 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="bg-white rounded-xl border border-border p-6 mb-5">
        <h2 className="font-heading font-black text-lg text-foreground mb-4">Your Cards ({cards?.length ?? 0})</h2>
        <div className="flex flex-col gap-3">
          {cards?.map((card, i) => (
            <div key={card.id} className="text-sm p-3 rounded-lg bg-secondary/40">
              <p className="font-semibold text-foreground">{i + 1}. {card.card_name}</p>
              {card.card_set && <p className="text-muted-foreground">{card.card_set}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Services & total */}
      <div className="bg-white rounded-xl border border-border p-6 mb-5">
        <h2 className="font-heading font-black text-lg text-foreground mb-4">Order Summary</h2>
        <div className="flex flex-col gap-2 text-sm">
          {services?.map((s) => (
            <div key={s.id} className="flex justify-between">
              <span className="text-muted-foreground">{s.service_name} × {s.quantity}</span>
              <span className="font-medium">{formatCurrency(s.price_cents * s.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-border mt-1 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(order.total_cents)}</span>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Questions? Email us at <a href={`mailto:${process.env.CONTACT_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL}`} className="text-primary font-medium">{process.env.CONTACT_EMAIL ?? process.env.BUSINESS_SHIPPING_EMAIL}</a>
      </p>
    </div>
  );
}
