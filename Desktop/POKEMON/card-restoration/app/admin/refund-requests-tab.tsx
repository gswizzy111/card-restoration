import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderLabel } from "@/lib/card-inquiries";
import { refundedSoFar } from "@/lib/refund-ledger";
import { cardGate, gateFacts, type GateCard } from "@/lib/work-gates";
import { REQUEST_STATUS_LABELS, SCOPE_LABELS, type RefundRequest } from "@/lib/refund-requests";
import { formatCurrency } from "@/lib/utils";
import { RefundRequestReview, type ReviewCard } from "./refund-request-review";

const et = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The Refund Requests tab on /admin: refunds customer support asked for,
 * waiting for an admin to approve (and issue) or deny, then the last few
 * decided. Approving runs the same refund as the order page's Refund button.
 */
export async function RefundRequestsTab() {
  const admin = createAdminClient();
  const [{ data: openRows }, { data: doneRows }] = await Promise.all([
    admin.from("refund_requests").select("*").in("status", ["pending", "processing"]).order("created_at", { ascending: true }),
    admin.from("refund_requests").select("*").in("status", ["approved", "denied"]).order("decided_at", { ascending: false }).limit(15),
  ]);
  const open = (openRows ?? []) as RefundRequest[];
  const done = (doneRows ?? []) as RefundRequest[];

  const orderIds = [...new Set([...open, ...done].map((r) => r.order_id))];
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id, order_number, customer_name, customer_email, status, total_cents, refunded_cents, payment_status").in("id", orderIds)
    : { data: [] };
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  // For each open request: what's left to refund, and each card's refundable fee
  const details = await Promise.all(
    open.map(async (r) => {
      const order = orderById.get(r.order_id);
      const [refunded, { data: cards }, facts] = await Promise.all([
        refundedSoFar(admin, r.order_id, order?.refunded_cents ?? null),
        admin.from("cards").select("id, card_name, estimated_value_cents, status, slab_removal_selected, cleaning_started_at, slab_opening_started_at, service_price_cents, discount_cents, tax_cents, refunded_cents").eq("order_id", r.order_id),
        gateFacts(admin, r.order_id),
      ]);
      const reviewCards: ReviewCard[] = (cards ?? []).map((c) => {
        const gate = cardGate(c as GateCard, facts);
        return { id: c.id, name: c.card_name, refundableCents: gate.refundableCents, note: c.status === "refunded" ? "Already refunded" : gate.nonRefundableNote, requested: r.card_ids.includes(c.id) };
      });
      return { totalCents: order?.total_cents ?? 0, refundedCents: refunded, cards: reviewCards };
    })
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-heading font-black text-lg text-foreground">Waiting for approval</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Refunds your support team asked for, oldest first. Nothing is refunded until you approve it here.</p>
        </div>
        {open.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No refund requests waiting.</p>
        ) : (
          <ul className="divide-y divide-border">
            {open.map((r, i) => {
              const order = orderById.get(r.order_id);
              const d = details[i];
              return (
                <li key={r.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-heading font-black text-base text-foreground">
                        Order {orderLabel(order?.order_number)} · {SCOPE_LABELS[r.scope]}
                      </p>
                      <p className="text-sm text-muted-foreground">{order?.customer_name ?? "—"} · {order?.customer_email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Asked by <span className="font-semibold text-foreground">{r.requested_by}</span> · {et(r.created_at)}</p>
                    </div>
                    <Link href={`/admin/orders/${r.order_id}`} className="text-sm font-semibold text-primary hover:underline">Open order →</Link>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-secondary/40 rounded-lg p-3 mb-3">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Paid {formatCurrency(d.totalCents)} · refunded so far {formatCurrency(d.refundedCents)} · <span className="font-semibold text-foreground">{formatCurrency(Math.max(0, d.totalCents - d.refundedCents))} left</span>
                  </p>
                  <RefundRequestReview
                    requestId={r.id}
                    status={r.status}
                    scope={r.scope}
                    remainingCents={Math.max(0, d.totalCents - d.refundedCents)}
                    cards={d.cards}
                    lastError={r.last_error}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {done.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-heading font-black text-base text-foreground">Recently decided</h2>
          </div>
          <ul className="divide-y divide-border">
            {done.map((r) => {
              const order = orderById.get(r.order_id);
              const s = REQUEST_STATUS_LABELS[r.status];
              return (
                <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <Link href={`/admin/orders/${r.order_id}`} className="font-semibold text-foreground hover:text-primary w-20">{orderLabel(order?.order_number)}</Link>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{r.status === "approved" ? "Approved" : "Denied"}</span>
                  {r.refunded_cents ? <span className="font-semibold">{formatCurrency(r.refunded_cents)}</span> : null}
                  <span className="text-muted-foreground flex-1 min-w-[12rem] truncate">{r.reason}</span>
                  <span className="text-xs text-muted-foreground">{r.requested_by} → {r.decided_by} · {r.decided_at ? et(r.decided_at) : ""}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
