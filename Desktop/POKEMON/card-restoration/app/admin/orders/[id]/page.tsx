import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, STATUS_TIMELINE, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusUpdater } from "./status-updater";
import { PhotoUploader } from "./photo-uploader";
import { ReturnLabelButton } from "./return-label-button";
import { CheckpointAdder } from "./checkpoint-adder";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: order }, { data: cards }, { data: services }, { data: events }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).single(),
    admin.from("cards").select("*").eq("order_id", id),
    admin.from("order_services").select("*").eq("order_id", id),
    admin.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);

  if (!order) notFound();

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
              <StatusUpdater orderId={order.id} currentStatus={order.status} />
            </div>

            {/* Restoration photos */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Restoration Photos</h2>
              <p className="text-sm text-muted-foreground mb-4">Upload photos of the finished cards — customers will see these when tracking their order.</p>
              <PhotoUploader
                orderId={order.id}
                existingPhotos={(order.restoration_photos as string[]) ?? []}
              />
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
                <p className="text-sm text-muted-foreground mb-4">Label cost: {formatCurrency(order.shipping_cents)}</p>
              )}
              {order.shipping_label_url && (
                <a
                  href={order.shipping_label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium text-primary hover:underline mb-4"
                >
                  Print Inbound Label (PDF)
                </a>
              )}
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Return to Customer</p>
              <ReturnLabelButton orderId={order.id} existingLabelUrl={order.return_label_url} />
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
