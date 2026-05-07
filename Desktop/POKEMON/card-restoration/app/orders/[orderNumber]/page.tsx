import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, STATUS_TIMELINE, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";

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

      {/* Restoration photos */}
      {order.restoration_photos?.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-6 mb-5">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">Your Restored Cards</h2>
          <div className="flex flex-wrap gap-3">
            {(order.restoration_photos as string[]).map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Restored card" className="w-28 h-28 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
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
        Questions? Email us at <a href="mailto:gavinfraiman33@gmail.com" className="text-primary font-medium">gavinfraiman33@gmail.com</a>
      </p>
    </div>
  );
}
