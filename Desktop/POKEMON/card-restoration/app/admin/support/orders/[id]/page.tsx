import Link from "next/link";
import { notFound } from "next/navigation";
import type { Track } from "shippo/models/components";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrSupport } from "@/lib/admin-auth";
import { shippo } from "@/lib/shippo";
import { thumbnail } from "@/lib/thumbnail";
import { STATUS_TIMELINE } from "@/lib/constants";
import { orderLabel } from "@/lib/card-inquiries";
import { currentStages, friendlyStage, parseStageEvent } from "@/lib/restoration-stages";
import { openProblemsFor } from "@/lib/email-problems";
import { PROBLEM_LABELS, problemAdvice } from "@/lib/email-problem-labels";
import { MONEY_EVENT_TYPES, etDate, statusLabel, tierLabel, withoutAmounts } from "@/lib/support-view";
import { ResendConfirmationButton } from "@/app/admin/orders/[id]/resend-confirmation-button";
import { SupportNoteForm } from "./support-note-form";
import { RefundRequestPanel, type PanelCard, type PanelRequest } from "./refund-request-panel";
import { cardGate, gateFacts, type GateCard } from "@/lib/work-gates";
import { OPEN_REFUND_STATUSES, REQUEST_STATUS_LABELS, type RefundRequest } from "@/lib/refund-requests";

export const dynamic = "force-dynamic";

// The order as customer support sees it: where it is, the cards, the
// customer's contact details and tracking. Nothing about money (totals,
// payments, refunds, discounts, codes), card values or signed agreements, and
// it changes nothing on the order: admins work from /admin/orders/[id]. It
// doesn't link to the customer's own tracking page, which shows prices.
const ORDER_COLUMNS = [
  "id", "order_number", "customer_name", "customer_email", "customer_phone", "ship_from_address",
  "status", "restoration_tier", "created_at", "due_date", "customer_notes", "inbound_method",
  "inbound_carrier", "inbound_service_level", "inbound_tracking_number", "tracking_number",
  "return_carrier", "return_service_level", "instagram_feature", "restoration_photos",
].join(", ");
const CARD_COLUMNS = [
  "id", "card_name", "card_set", "card_year", "card_number", "variation", "grading_company", "grade",
  "tier", "completed", "completed_at", "photo_urls", "notes", "current_round", "status",
  "pregrade_selected", "pregrade_result", "pregrade_notes", "pregrade_submitted_at",
].join(", ");

function carrierToken(provider: string): string {
  const map: Record<string, string> = { USPS: "usps", FedEx: "fedex", UPS: "ups", DHLExpress: "dhl_express", "DHL Express": "dhl_express", DHL: "dhl" };
  return map[provider] ?? provider.toLowerCase().replace(/\s+/g, "_");
}

const TRACKING_BADGE: Record<string, { label: string; cls: string }> = {
  UNKNOWN: { label: "Label Created", cls: "bg-gray-100 text-gray-600" },
  PRE_TRANSIT: { label: "Label Created", cls: "bg-gray-100 text-gray-600" },
  TRANSIT: { label: "In Transit", cls: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Delivered", cls: "bg-green-100 text-green-700" },
  RETURNED: { label: "Returned", cls: "bg-orange-100 text-orange-700" },
  FAILURE: { label: "Issue", cls: "bg-red-100 text-red-700" },
};

type Order = {
  id: string; order_number: number; customer_name: string | null; customer_email: string | null; customer_phone: string | null;
  ship_from_address: Record<string, string> | null; status: string; restoration_tier: string | null; created_at: string;
  due_date: string | null; customer_notes: string | null; inbound_method: string | null; inbound_carrier: string | null;
  inbound_service_level: string | null; inbound_tracking_number: string | null; tracking_number: string | null;
  return_carrier: string | null; return_service_level: string | null; instagram_feature: boolean | null; restoration_photos: string[] | null;
};
type Card = {
  id: string; card_name: string; card_set: string | null; card_year: string | null; card_number: string | null; variation: string | null;
  grading_company: string | null; grade: string | null; tier: string | null; completed: boolean | null; completed_at: string | null;
  photo_urls: string[] | null; notes: string | null; current_round: number | null; status: string | null;
  pregrade_selected: boolean | null; pregrade_result: string | null; pregrade_notes: string | null; pregrade_submitted_at: string | null;
};
type Event = { id: string; event_type: string; description: string | null; is_customer_visible: boolean | null; metadata: unknown; created_at: string };

function TrackingBox({ track, tone }: { track: Track | null; tone: "blue" | "cyan" }) {
  if (!track) return <p className="text-xs text-muted-foreground">Live tracking status unavailable.</p>;
  const status = track.trackingStatus?.status ?? "UNKNOWN";
  const badge = TRACKING_BADGE[status] ?? TRACKING_BADGE.UNKNOWN;
  return (
    <div className={`p-3 rounded-lg border ${tone === "blue" ? "bg-blue-50 border-blue-200" : "bg-cyan-50 border-cyan-200"}`}>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
      {track.trackingStatus?.statusDetails && <p className="text-xs mt-1.5 text-foreground">{track.trackingStatus.statusDetails}</p>}
      {track.eta && (
        <p className="text-xs font-semibold mt-1">ETA: {new Date(track.eta).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
      )}
    </div>
  );
}

export default async function SupportOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireAdminOrSupport();
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: orderRow }, { data: cardRows }, { data: eventRows }, { data: requestRows }, { data: payment }] = await Promise.all([
    admin.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle(),
    admin.from("cards").select(CARD_COLUMNS).eq("order_id", id).order("created_at"),
    admin.from("order_events").select("id, event_type, description, is_customer_visible, metadata, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    admin.from("refund_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    // Only whether there's anything left to refund, never the amounts
    admin.from("orders").select("payment_status").eq("id", id).maybeSingle(),
  ]);
  const order = orderRow as unknown as Order | null;
  if (!order) notFound();
  const cards = (cardRows ?? []) as unknown as Card[];
  const events = (eventRows ?? []) as unknown as Event[];

  const roundByCard = Object.fromEntries(cards.map((c) => [c.id, c.current_round ?? 1]));
  const stageByCard = currentStages(events, roundByCard);
  const cardName = new Map(cards.map((c) => [c.id, c.card_name]));

  const returnTracking = order.tracking_number;
  const [inboundTrack, returnTrack, emailProblems]: [Track | null, Track | null, Awaited<ReturnType<typeof openProblemsFor>>] = await Promise.all([
    order.inbound_tracking_number && order.inbound_carrier
      ? shippo.trackingStatus.get(order.inbound_tracking_number, carrierToken(order.inbound_carrier)).catch(() => null)
      : null,
    returnTracking
      ? shippo.trackingStatus.get(returnTracking, carrierToken(order.return_carrier ?? "USPS")).catch(() => null)
      : null,
    openProblemsFor(order.customer_email),
  ]);

  // Refund requests: which cards could still be refunded (work not started,
  // Terms Section 11), worked out here so no prices reach the page
  const [{ data: gateRows }, facts] = await Promise.all([
    admin.from("cards").select("id, card_name, estimated_value_cents, status, slab_removal_selected, cleaning_started_at, slab_opening_started_at, service_price_cents, discount_cents, tax_cents, refunded_cents").eq("order_id", id),
    gateFacts(admin, id),
  ]);
  const panelCards: PanelCard[] = (gateRows ?? []).map((c) => ({
    id: c.id,
    name: c.card_name,
    refundable: cardGate(c as GateCard, facts).refundableCents > 0,
    refunded: c.status === "refunded",
  }));
  const panelRequests: PanelRequest[] = ((requestRows ?? []) as RefundRequest[]).map((r) => ({
    id: r.id,
    scope: r.scope,
    cardNames: r.card_ids.map((cid) => cardName.get(cid) ?? "A card"),
    reason: r.reason,
    requestedBy: r.requested_by,
    createdAt: etDate(r.created_at, true),
    statusLabel: REQUEST_STATUS_LABELS[r.status].label,
    statusCls: REQUEST_STATUS_LABELS[r.status].cls,
    isOpen: OPEN_REFUND_STATUSES.includes(r.status),
    decidedBy: r.decided_by,
    decidedAt: r.decided_at ? etDate(r.decided_at, true) : null,
    decisionNote: r.decision_note,
  }));
  const paid = payment?.payment_status === "paid" || payment?.payment_status === "partially_refunded";

  const address = order.ship_from_address;
  const stepIndex = STATUS_TIMELINE.indexOf(order.status as (typeof STATUS_TIMELINE)[number]);
  const done = cards.filter((c) => c.completed).length;
  // Activity: everything but money, newest first; stage moves read as words
  const activity = events
    .filter((e) => !MONEY_EVENT_TYPES.includes(e.event_type))
    .map((e) => {
      const stage = parseStageEvent(e);
      const text = stage
        ? `${cardName.get(stage.card_id) ?? "A card"}: ${friendlyStage(stage.stage, stage.round)}`
        : withoutAmounts(e.description ?? e.event_type.replace(/_/g, " "));
      return { ...e, text };
    });

  const box = "bg-white rounded-xl border border-border p-5 sm:p-6";
  const h2 = "font-heading font-black text-lg text-foreground mb-3";

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link href="/admin/support" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Order lookup</Link>
          <div className="flex flex-wrap items-center gap-2">
            <ResendConfirmationButton orderId={order.id} />
            {role === "admin" && (
              <Link href={`/admin/orders/${order.id}`} className="h-9 px-3 flex items-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">Full admin view →</Link>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0 flex flex-col gap-5">
            {/* Header and status */}
            <div className={box}>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-heading font-black text-2xl text-foreground">Order {orderLabel(order.order_number)}</h1>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-secondary text-foreground">{tierLabel(order.restoration_tier)}</span>
                <span className="text-sm font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">{statusLabel(order.status)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Placed {etDate(order.created_at, true)}{order.due_date ? ` · due ${etDate(order.due_date)}` : ""}
              </p>
              {order.status !== "cancelled" && stepIndex >= 0 && (
                <ol className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {STATUS_TIMELINE.map((s, i) => (
                    <li key={s} className={`text-[11px] font-semibold rounded-lg px-2 py-1.5 text-center ${i < stepIndex ? "bg-green-50 text-green-700" : i === stepIndex ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      {statusLabel(s)}
                    </li>
                  ))}
                </ol>
              )}
              {order.instagram_feature && (
                <p className="mt-4 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">📹 This customer bought the Instagram video feature: their card is filmed before it ships.</p>
              )}
            </div>

            {/* Cards */}
            <div className={box}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-black text-lg text-foreground">Cards ({cards.length})</h2>
                {cards.length > 0 && <span className="text-sm font-bold text-muted-foreground">{done}/{cards.length} done</span>}
              </div>
              <div className="flex flex-col gap-4">
                {cards.map((c) => {
                  const stage = stageByCard[c.id];
                  const details = [c.card_year, c.card_set, c.card_number && `#${c.card_number}`, c.variation].filter(Boolean).join(" · ");
                  const graded = c.grading_company ? `${c.grading_company}${c.grade ? ` ${c.grade}` : ""}` : null;
                  return (
                    <div key={c.id} className="border border-border rounded-lg p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{c.card_name}</p>
                          {details && <p className="text-xs text-muted-foreground">{details}</p>}
                          {graded && <p className="text-xs text-muted-foreground">Graded: {graded}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.tier && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary">{tierLabel(c.tier)}</span>}
                          {c.status && c.status !== "active" && c.status !== "in_progress" && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${c.status === "refunded" || c.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-secondary text-foreground"}`}>{c.status.replace(/_/g, " ")}</span>
                          )}
                          {c.completed ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Done{c.completed_at ? ` ${etDate(c.completed_at)}` : ""}</span>
                          ) : stage ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{friendlyStage(stage, c.current_round ?? 1)}</span>
                          ) : null}
                        </div>
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap"><span className="font-semibold">Notes:</span> {c.notes}</p>}
                      {c.pregrade_selected && (
                        <p className="text-xs mt-2">
                          <span className="font-semibold">Pre-grade:</span>{" "}
                          {c.pregrade_submitted_at ? `${c.pregrade_result ?? "sent"}${c.pregrade_notes ? ` — ${c.pregrade_notes}` : ""} (sent ${etDate(c.pregrade_submitted_at)})` : "paid for, not sent yet"}
                        </p>
                      )}
                      {(c.photo_urls?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {c.photo_urls!.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={thumbnail(u, 64)} alt={`${c.card_name} photo ${i + 1}`} className="w-16 h-16 object-cover rounded-md border border-border" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {cards.length === 0 && <p className="text-sm text-muted-foreground">No cards on this order.</p>}
              </div>
              {(order.restoration_photos?.length ?? 0) > 0 && (
                <div className="border-t border-border mt-5 pt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Finished photos (the customer sees these)</p>
                  <div className="flex flex-wrap gap-2">
                    {order.restoration_photos!.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbnail(u, 80)} alt={`Finished photo ${i + 1}`} className="w-20 h-20 object-cover rounded-md border border-border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Activity and notes */}
            <div className={box}>
              <h2 className={h2}>Activity</h2>
              <div className="mb-5">
                <SupportNoteForm orderId={order.id} />
              </div>
              <div className="flex flex-col gap-3">
                {activity.map((e) => (
                  <div key={e.id} className={`text-sm border-l-2 pl-3 ${e.event_type === "support_note" ? "border-amber-400" : "border-border"}`}>
                    <p className="text-foreground break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{e.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {etDate(e.created_at, true)}
                      {e.is_customer_visible ? <span className="text-green-600 font-medium"> · customer can see this</span> : null}
                    </p>
                  </div>
                ))}
                {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:w-80 flex flex-col gap-5">
            <div className={box}>
              <h2 className={h2}>Customer</h2>
              {emailProblems.length > 0 && (
                <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-bold">Our emails to this address aren&apos;t arriving</p>
                  <p className="mt-1">{PROBLEM_LABELS[emailProblems[0].type]} {etDate(emailProblems[0].received_at)}. {problemAdvice(emailProblems[0].type)}</p>
                  <Link href="/admin/email-problems" className="mt-1 inline-block font-semibold underline">See Email Problems</Link>
                </div>
              )}
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold text-foreground">{order.customer_name ?? "—"}</p>
                {order.customer_email && <a href={`mailto:${order.customer_email}`} className="text-primary hover:underline break-all">{order.customer_email}</a>}
                {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="text-muted-foreground">{order.customer_phone}</a>}
              </div>
              {address && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1">Ships back to</p>
                  <p>{address.street1}{address.street2 ? `, ${address.street2}` : ""}</p>
                  <p>{[address.city, address.state, address.zip].filter(Boolean).join(", ")}{address.country && address.country !== "US" ? `, ${address.country}` : ""}</p>
                </div>
              )}
              {order.customer_notes && (
                <div className="mt-4 text-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Customer&apos;s notes</p>
                  <p className="text-foreground whitespace-pre-wrap">{order.customer_notes}</p>
                </div>
              )}
            </div>

            <div className={box}>
              <h2 className={h2}>Shipping</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Cards to us</p>
              <p className="text-sm text-foreground mb-2">
                {order.inbound_method === "buy_label" ? "Our prepaid label" : order.inbound_method === "self_ship" ? "Customer ships it their own way" : order.inbound_method === "dropoff" ? "Drop-off" : order.inbound_method ?? "—"}
                {order.inbound_carrier ? ` · ${order.inbound_carrier} ${order.inbound_service_level ?? ""}` : ""}
              </p>
              {order.inbound_tracking_number ? (
                <>
                  <p className="font-mono text-sm font-semibold text-foreground mb-2 break-all">{order.inbound_tracking_number}</p>
                  <TrackingBox track={inboundTrack} tone="blue" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No inbound tracking number on file.</p>
              )}

              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-5 mb-1">Back to the customer</p>
              {returnTracking ? (
                <>
                  <p className="text-sm text-foreground mb-1">{order.return_carrier ?? "USPS"} {order.return_service_level ?? ""}</p>
                  <p className="font-mono text-sm font-semibold text-foreground mb-2 break-all">{returnTracking}</p>
                  <TrackingBox track={returnTrack} tone="cyan" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not shipped back yet.</p>
              )}
            </div>

            <RefundRequestPanel
              orderId={order.id}
              requests={panelRequests}
              cards={panelCards}
              canRequest={paid}
              cannotRequestReason={paid ? null : "There's nothing to refund on this order (it isn't paid, or it's already fully refunded)."}
            />

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
              Payment questions, changing the order or the address, and damaged cards go to an admin. Add a note here saying what the customer asked.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
