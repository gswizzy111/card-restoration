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
import { OrderEditor } from "./order-editor";
import { CustomerEditor } from "./customer-editor";
import { DeleteOrderButton } from "./delete-order-button";
import { CardCompletionToggle } from "./card-completion-toggle";
import { AdminCardEditor } from "./admin-card-editor";
import { AddCardButton } from "./add-card-button";
import { RefundButton } from "./refund-button";
import { ResendConfirmationButton } from "./resend-confirmation-button";
import { PaymentMethodEditor } from "./payment-method-editor";
import { RegenerateLabelButton } from "./regenerate-label-button";
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
  const orderDueDate = (order as Record<string, unknown>).due_date as string | null ?? null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-3 mb-8">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← All Orders
          </Link>
          <div className="flex items-center gap-2">
            <ResendConfirmationButton orderId={order.id} />
            <DeleteOrderButton orderId={order.id} orderNumber={order.order_number} />
          </div>
        </div>

        {/* Refund banner — shown prominently when any refund has been issued */}
        {((order.refunded_cents as number) ?? 0) > 0 && (() => {
          const refunded = order.refunded_cents as number;
          const total = order.total_cents as number;
          const isFull = refunded >= total;
          return (
            <div className={`rounded-xl border-2 p-5 mb-2 flex items-center gap-4 ${isFull ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
              <span className="text-3xl shrink-0">{isFull ? "💸" : "↩️"}</span>
              <div className="flex-1">
                <p className={`font-heading font-black text-lg ${isFull ? "text-red-700" : "text-amber-800"}`}>
                  {isFull ? "Fully Refunded" : "Partial Refund Issued"}
                </p>
                <p className={`text-sm font-semibold ${isFull ? "text-red-600" : "text-amber-700"}`}>
                  {formatCurrency(refunded)} refunded{isFull ? "" : ` · ${formatCurrency(total - refunded)} remaining`}
                </p>
              </div>
              {isFull && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-200 text-red-800 uppercase tracking-wide">Cancelled</span>
              )}
            </div>
          );
        })()}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Header */}
            <div className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="font-heading font-black text-2xl text-foreground">Order #{order.order_number}</h1>
                    {order.restoration_tier && (() => {
                      const TIER_BADGE: Record<string, { label: string; cls: string }> = {
                        elite:         { label: "Diamond",  cls: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
                        ultra_premium: { label: "Platinum", cls: "bg-blue-100 text-blue-600 border border-blue-300" },
                        premium:       { label: "Gold",     cls: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
                        expedited:     { label: "Silver",   cls: "bg-slate-100 text-slate-600 border border-slate-300" },
                        regular:       { label: "Bronze",   cls: "bg-amber-100 text-amber-700 border border-amber-300" },
                      };
                      const badge = TIER_BADGE[order.restoration_tier] ?? { label: order.restoration_tier, cls: "bg-gray-100 text-gray-600 border border-gray-200" };
                      return (
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
                </div>
                <span className="font-heading font-black text-2xl text-primary">{formatCurrency(order.total_cents)}</span>
              </div>
            </div>

            {/* Instagram Feature Alert — huge red banner */}
            {((order.instagram_feature as boolean) || services?.some((s) => s.service_id === "instagram_feature")) && (
              <div className="rounded-xl border-4 border-red-600 bg-red-600 p-6 flex items-center gap-5 shadow-lg">
                <span className="text-5xl shrink-0">📸</span>
                <div>
                  <p className="font-heading font-black text-2xl text-white leading-tight">📹 INSTAGRAM VIDEO PURCHASED</p>
                  <p className="text-base font-bold text-red-100 mt-1">This customer paid $100 to have their card filmed and featured on @the_card_doc. Do NOT ship without filming!</p>
                </div>
              </div>
            )}

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
                cards={(cards ?? []).map((c) => ({
                  card_name: c.card_name,
                  card_set: c.card_set ?? null,
                  card_number: c.card_number ?? null,
                  estimated_value_cents: c.estimated_value_cents ?? null,
                  notes: c.notes ?? null,
                  tier: c.tier ?? null,
                }))}
                orderTier={(order.restoration_tier as string | null) ?? null}
                customerNotes={(order.customer_notes as string | null) ?? null}
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
              {(() => {
                const total = cards?.length ?? 0;
                const done = (cards ?? []).filter((c) => c.completed).length;
                const allDone = total > 0 && done === total;
                return (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-heading font-black text-lg text-foreground">
                      Cards ({total})
                    </h2>
                    {total > 0 && (
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                        allDone ? "bg-green-100 text-green-700" : done > 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        <span>{done}/{total} done</span>
                        {allDone && (
                          <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex flex-col gap-4">
                {cards?.map((card, i) => {
                  const CARD_TIER_BADGE: Record<string, { label: string; cls: string }> = {
                    elite:         { label: "Diamond",   cls: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
                    ultra_premium: { label: "Platinum",  cls: "bg-blue-100 text-blue-600 border border-blue-300" },
                    premium:       { label: "Gold",      cls: "bg-yellow-100 text-yellow-700 border border-yellow-300" },
                    expedited:     { label: "Silver",    cls: "bg-slate-100 text-slate-600 border border-slate-300" },
                    regular:       { label: "Bronze",    cls: "bg-amber-100 text-amber-700 border border-amber-300" },
                    fast_pass:     { label: "Fast Pass", cls: "bg-green-100 text-green-700 border border-green-300" },
                  };
                  const cardTier = card.tier ?? order.restoration_tier;
                  const tierBadge = cardTier ? (CARD_TIER_BADGE[cardTier] ?? { label: cardTier, cls: "bg-gray-100 text-gray-600" }) : null;
                  const orig = (card as Record<string, unknown>).original_data as {
                    card_name?: string; card_set?: string | null; card_year?: string | null;
                    estimated_value_cents?: number | null; notes?: string | null; photo_urls?: string[];
                  } | null ?? null;

                  // Detect which fields changed vs. original
                  const changed = orig ? {
                    name: card.card_name !== orig.card_name,
                    set: (card.card_set ?? null) !== (orig.card_set ?? null),
                    year: ((card as Record<string,unknown>).card_year ?? null) !== (orig.card_year ?? null),
                    value: (card.estimated_value_cents ?? null) !== (orig.estimated_value_cents ?? null),
                    notes: (card.notes ?? null) !== (orig.notes ?? null),
                    photos: JSON.stringify(card.photo_urls ?? []) !== JSON.stringify(orig.photo_urls ?? []),
                  } : null;
                  const anyChanged = changed && Object.values(changed).some(Boolean);

                  return (
                  <div key={card.id} className={`rounded-lg border transition-colors overflow-hidden ${
                    card.completed ? "border-green-200" : "border-border"
                  }`}>
                    {/* Card header */}
                    <div className={`flex items-start justify-between gap-3 px-4 pt-4 pb-2 ${card.completed ? "bg-green-50" : "bg-secondary/40"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold ${card.completed ? "text-green-700 line-through decoration-green-400" : "text-foreground"}`}>
                          {i + 1}. {card.card_name}
                        </p>
                        {tierBadge && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierBadge.cls}`}>{tierBadge.label}</span>
                        )}
                        {anyChanged && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Edited</span>
                        )}
                      </div>
                      <CardCompletionToggle cardId={card.id} initialCompleted={!!card.completed} />
                    </div>

                    {/* Side-by-side diff — only when admin has edited */}
                    {orig && anyChanged ? (
                      <div className="grid grid-cols-2 divide-x divide-border text-sm">
                        {/* Original column */}
                        <div className="p-3 bg-gray-50 flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Customer</p>
                          <p className="font-medium text-foreground">{orig.card_name ?? "—"}</p>
                          {orig.card_set && <p className="text-muted-foreground">Set: {orig.card_set}</p>}
                          {orig.card_year && <p className="text-muted-foreground">Year: {orig.card_year}</p>}
                          {orig.estimated_value_cents && (
                            <p className="text-muted-foreground">Value: {formatCurrency(orig.estimated_value_cents)}</p>
                          )}
                          {orig.notes && <p className="text-muted-foreground">Notes: {orig.notes}</p>}
                          {(orig.photo_urls ?? []).length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mt-1">
                              {(orig.photo_urls ?? []).map((url: string, j: number) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="" className="w-12 h-12 object-cover rounded border border-border opacity-70" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Edited column */}
                        <div className="p-3 bg-white flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-0.5">Admin Edited</p>
                          <p className={`font-medium ${changed.name ? "text-red-700 font-bold" : "text-foreground"}`}>
                            {card.card_name}
                          </p>
                          {(card.card_set || orig.card_set) && (
                            <p className={changed.set ? "text-red-700 font-semibold" : "text-muted-foreground"}>
                              Set: {card.card_set ?? <span className="italic text-muted-foreground">removed</span>}
                            </p>
                          )}
                          {((card as Record<string,unknown>).card_year || orig.card_year) && (
                            <p className={changed.year ? "text-red-700 font-semibold" : "text-muted-foreground"}>
                              Year: {(card as Record<string,unknown>).card_year as string ?? <span className="italic text-muted-foreground">removed</span>}
                            </p>
                          )}
                          {(card.estimated_value_cents || orig.estimated_value_cents) && (
                            <p className={changed.value ? "text-red-700 font-semibold" : "text-muted-foreground"}>
                              Value: {card.estimated_value_cents ? formatCurrency(card.estimated_value_cents) : <span className="italic text-muted-foreground">removed</span>}
                            </p>
                          )}
                          {(card.notes || orig.notes) && (
                            <p className={changed.notes ? "text-red-700 font-semibold" : "text-muted-foreground"}>
                              Notes: {card.notes ?? <span className="italic text-muted-foreground">removed</span>}
                            </p>
                          )}
                          {(card.photo_urls?.length > 0 || (orig.photo_urls ?? []).length > 0) && (
                            <div className="flex gap-1.5 flex-wrap mt-1">
                              {(card.photo_urls as string[] ?? []).map((url: string, j: number) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="" className={`w-12 h-12 object-cover rounded border ${changed.photos ? "border-red-400 ring-1 ring-red-300" : "border-border"}`} />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* No edits — single column display */
                      <div className={`px-4 pb-3 flex flex-col gap-1 text-sm ${card.completed ? "bg-green-50" : "bg-secondary/40"}`}>
                        {card.card_set && <p className="text-muted-foreground">Set: {card.card_set}</p>}
                        {(card as Record<string,unknown>).card_year && <p className="text-muted-foreground">Year: {(card as Record<string,unknown>).card_year as string}</p>}
                        {card.card_number && <p className="text-muted-foreground">Card #: {card.card_number}</p>}
                        {card.estimated_value_cents && (
                          <p className="text-muted-foreground">Est. value: {formatCurrency(card.estimated_value_cents)}</p>
                        )}
                        {card.notes && <p className="text-muted-foreground mt-0.5">Notes: {card.notes}</p>}
                        {card.photo_urls?.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {(card.photo_urls as string[]).map((url: string, j: number) => (
                              <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="Card photo" className="w-16 h-16 object-cover rounded border border-border" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Edit button row */}
                    <div className={`px-4 py-2 border-t border-border ${card.completed ? "bg-green-50" : "bg-secondary/40"}`}>
                      <AdminCardEditor
                        card={{
                          id: card.id,
                          card_name: card.card_name,
                          card_set: card.card_set ?? null,
                          card_year: (card as Record<string, unknown>).card_year as string | null ?? null,
                          estimated_value_cents: card.estimated_value_cents ?? null,
                          notes: card.notes ?? null,
                          photo_urls: (card.photo_urls as string[] | null) ?? null,
                        }}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
              <AddCardButton orderId={order.id} orderTier={order.restoration_tier as string | null} />
            </div>

            {/* Services + editor */}
            <div className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-black text-lg text-foreground">Services</h2>
                <OrderEditor
                  orderId={order.id}
                  totalCents={order.total_cents}
                  dueDate={orderDueDate}
                  customerNotes={order.customer_notes as string | null}
                  cards={(cards ?? []).map((c) => ({ id: c.id, card_name: c.card_name }))}
                  services={(services ?? []).map((s) => ({ id: s.id, service_name: s.service_name, price_cents: s.price_cents, quantity: s.quantity }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                {services?.filter((s) => s.service_id !== "instagram_feature").map((s) => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{s.service_name} × {s.quantity}</span>
                    <span className="font-bold text-foreground">{formatCurrency(s.price_cents * s.quantity)}</span>
                  </div>
                ))}
                {orderDueDate && (
                  <div className="flex justify-between text-sm text-muted-foreground pt-1">
                    <span>Due date</span>
                    <span>{new Date(orderDueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                )}
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(order.total_cents)}</span>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            {(() => {
              const subtotalCents: number = (order.subtotal_cents as number) ?? 0;
              const discountCents: number = (order.discount_cents as number) ?? 0;
              const discountPct: number = (order.discount_percent as number) ?? 0;
              const shippingCents: number = (order.shipping_cents as number) ?? 0;
              const totalCents: number = order.total_cents ?? 0;

              // Re-compute tax using same rate as checkout (tax is on subtotal after best discount)
              const TAX_RATE = 0.06625;
              // Compute effective discount early for tax base (loyalty overrides affiliate if higher)
              const loyaltyPctEarly: number = (order.loyalty_discount_percent as number) ?? 0;
              const loyaltyCentsEarly = loyaltyPctEarly > 0 ? Math.round(subtotalCents * loyaltyPctEarly / 100) : 0;
              const effectiveDiscountForTax = Math.max(discountCents, loyaltyCentsEarly);
              const taxCents = Math.round((subtotalCents - effectiveDiscountForTax) * TAX_RATE);

              // Slab crack from DB column (saved by checkout + webhook)
              const slabCount = (order.slab_crack_count as number) ?? 0;
              const slabCents = slabCount * 700;

              // Instagram feature from DB column
              const instagramCents = (order.instagram_feature as boolean) ? 10000 : 0;

              // Re-compute insurance using same formula as checkout (1.5% × 1.1 markup, min $2.50)
              const declaredValueCents: number = (order.insurance_declared_value_cents as number) ?? 0;
              const insuranceType: string | null = (order.insurance_type as string | null) ?? null;
              let insuranceCents = 0;
              if (declaredValueCents > 0 && insuranceType && insuranceType !== "none") {
                const shippoCost = Math.max(Math.round(declaredValueCents * 0.015), 250);
                const perDir = Math.round(shippoCost * 1.1);
                insuranceCents = insuranceType === "round_trip" ? perDir * 2 : perDir;
              }

              // Signature confirmation — read from saved DB field (saved by webhook for new orders)
              const signatureCents = (order.add_signature_confirmation as boolean) ? 500 : 0;

              const gcApplied: number = (order.gift_card_discount_cents as number) ?? 0;
              const loyaltyPct: number = (order.loyalty_discount_percent as number) ?? 0;
              const loyaltyCents = loyaltyPct > 0 ? Math.round(subtotalCents * loyaltyPct / 100) : 0;
              const effectiveDiscountCents = Math.max(discountCents, loyaltyCents);
              const knownSum = subtotalCents - effectiveDiscountCents + taxCents + shippingCents + instagramCents + insuranceCents + slabCents + signatureCents - gcApplied;
              const residual = totalCents - knownSum;
              // Any unaccounted residual > $0.50 is shown as a catch-all for older orders missing data
              const unaccountedCents = residual > 50 ? residual : 0;

              const rows: { label: string; cents: number; style?: string }[] = [];

              // Restoration per card
              if ((cards ?? []).length > 0 && subtotalCents > 0) {
                const uniqueTiers = [...new Set((cards ?? []).map((c) => (c as Record<string,unknown>).tier ?? order.restoration_tier).filter(Boolean))];
                if (uniqueTiers.length <= 1) {
                  rows.push({ label: `Restoration — ${order.restoration_tier ?? "service"} (${cards?.length ?? 1} card${(cards?.length ?? 1) !== 1 ? "s" : ""})`, cents: subtotalCents });
                } else {
                  rows.push({ label: `Restoration (${cards?.length ?? 1} cards, mixed tiers)`, cents: subtotalCents });
                }
              } else if (subtotalCents > 0) {
                rows.push({ label: "Restoration", cents: subtotalCents });
              }

              if (slabCents > 0) rows.push({ label: `Slab crack × ${slabCount}`, cents: slabCents });
              if (instagramCents > 0) rows.push({ label: "Instagram Feature", cents: instagramCents });
              if (loyaltyCents > 0 && loyaltyCents >= discountCents) {
                rows.push({ label: `Loyalty Discount (${loyaltyPct}% off)`, cents: -loyaltyCents, style: "text-green-600" });
              } else if (effectiveDiscountCents > 0) {
                rows.push({ label: `Discount${discountPct > 0 ? ` (${discountPct}% off)` : ""}`, cents: -effectiveDiscountCents, style: "text-green-600" });
              }
              rows.push({ label: "Sales Tax (6.625%)", cents: taxCents, style: "text-muted-foreground" });
              if (shippingCents > 0) rows.push({ label: "Shipping (prepaid label)", cents: shippingCents, style: "text-muted-foreground" });
              if (insuranceCents > 0) rows.push({ label: `Insured Shipping (${insuranceType === "round_trip" ? "round trip" : "inbound"})`, cents: insuranceCents, style: "text-muted-foreground" });
              if (signatureCents > 0) rows.push({ label: "Signature Confirmation", cents: signatureCents, style: "text-muted-foreground" });
              if (unaccountedCents > 0) rows.push({ label: "Other charges (slab crack, add-ons — check Stripe)", cents: unaccountedCents, style: "text-amber-700" });
              if (gcApplied > 0) rows.push({ label: "Gift Card Applied", cents: -gcApplied, style: "text-green-600" });

              return (
                <div className="bg-white rounded-xl border border-border p-6">
                  <h2 className="font-heading font-black text-lg text-foreground mb-4">Payment Breakdown</h2>
                  <div className="flex flex-col gap-2">
                    {rows.map((row, i) => (
                      <div key={i} className={`flex justify-between text-sm ${row.style ?? "text-foreground"}`}>
                        <span>{row.label}</span>
                        <span className={row.cents < 0 ? "font-semibold" : "font-medium"}>
                          {row.cents < 0 ? `−${formatCurrency(-row.cents)}` : formatCurrency(row.cents)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-border mt-1 pt-3 flex justify-between font-black text-foreground text-base">
                      <span>Total Charged</span>
                      <span className="text-primary">{formatCurrency(totalCents)}</span>
                    </div>
                    {order.affiliate_code && (
                      <p className="text-xs text-muted-foreground pt-1">Affiliate/coupon: <span className="font-mono font-semibold">{order.affiliate_code as string}</span></p>
                    )}
                    {order.gift_card_code && (
                      <p className="text-xs text-muted-foreground">Gift card: <span className="font-mono font-semibold">{order.gift_card_code as string}</span></p>
                    )}
                    <PaymentMethodEditor orderId={order.id} current={(order as any).payment_method ?? null} />
                    {((order.refunded_cents as number) ?? 0) > 0 && (
                      <div className="border-t border-red-200 mt-2 pt-2 flex justify-between text-sm text-red-600 font-semibold">
                        <span>Refunded</span>
                        <span>−{formatCurrency((order.refunded_cents as number))}</span>
                      </div>
                    )}
                    {((order.refunded_cents as number) ?? 0) > 0 && (
                      <div className="flex justify-between text-sm font-black text-foreground">
                        <span>Net Collected</span>
                        <span>{formatCurrency(Math.max(0, totalCents - ((order.refunded_cents as number) ?? 0)))}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right column */}
          <div className="lg:w-72 flex flex-col gap-5">

            {/* Customer info */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Customer</h2>
              <CustomerEditor
                orderId={order.id}
                name={order.customer_name}
                email={order.customer_email}
                phone={order.customer_phone}
                street1={address?.street1}
                street2={address?.street2}
                city={address?.city}
                state={address?.state}
                zip={address?.zip}
              />
            </div>

            {/* Refund */}
            {order.payment_status === "paid" || order.payment_status === "partially_refunded" || order.payment_status === "refunded" ? (
              <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="font-heading font-black text-lg text-foreground mb-3">Refund</h2>
                <RefundButton
                  orderId={order.id}
                  totalCents={order.total_cents as number}
                  alreadyRefundedCents={(order.refunded_cents as number) ?? 0}
                  customerEmail={order.customer_email}
                />
              </div>
            ) : null}

            {/* Shipping */}
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-3">Shipping</h2>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm text-foreground font-medium">
                  {order.inbound_method === "buy_label" ? "Prepaid inbound label purchased" : "Customer shipping own way"}
                </p>
                {order.inbound_method === "buy_label" && order.shipping_label_url && (
                  <a
                    href={order.shipping_label_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    📄 Open Label
                  </a>
                )}
              </div>
              {order.inbound_method === "buy_label" && !order.shipping_label_url && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-amber-800">⚠️ Label not generated</p>
                  <p className="text-xs text-amber-700 mt-0.5">The Shippo purchase failed at checkout time. Customer paid but has no label.</p>
                  <RegenerateLabelButton orderId={order.id} />
                </div>
              )}
              {order.shipping_cents > 0 && (
                <p className="text-sm text-muted-foreground mb-3">Label cost: {formatCurrency(order.shipping_cents)}</p>
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
