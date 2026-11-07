"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

export type ReviewCard = {
  id: string;
  name: string;
  /** What refunding this card's fee would return now (0 once work started) */
  refundableCents: number;
  /** Why it can't be refunded, if it can't */
  note: string | null;
  requested: boolean;
};

/**
 * Approve or deny one refund request. Approving issues the refund through
 * Stripe right away: either the chosen cards' fees (one refund per card), or
 * an amount on the order.
 */
export function RefundRequestReview({
  requestId,
  status,
  scope,
  remainingCents,
  cards,
  lastError,
}: {
  requestId: string;
  status: "pending" | "processing" | "approved" | "denied";
  scope: "order" | "cards" | "other";
  remainingCents: number;
  cards: ReviewCard[];
  lastError: string | null;
}) {
  const router = useRouter();
  const requestedRefundable = cards.filter((c) => c.requested && c.refundableCents > 0);
  const [mode, setMode] = useState<"cards" | "amount">(scope === "cards" && requestedRefundable.length > 0 ? "cards" : "amount");
  const [cardIds, setCardIds] = useState<string[]>(requestedRefundable.map((c) => c.id));
  const [dollars, setDollars] = useState(scope === "order" ? (remainingCents / 100).toFixed(2) : "");
  const [sendEmail, setSendEmail] = useState(true);
  const [customerMessage, setCustomerMessage] = useState("");
  const [note, setNote] = useState("");
  const [denying, setDenying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cardsTotal = cards.filter((c) => cardIds.includes(c.id)).reduce((s, c) => s + c.refundableCents, 0);
  const amountCents = Math.round(parseFloat(dollars.replace(/[^0-9.]/g, "")) * 100);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/refund-requests/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { setError(data?.error ?? "Something went wrong. Please try again."); router.refresh(); return; }
    if (data?.failed?.length) alert(`Refunded ${formatCurrency(data.amountCents)}. Some cards weren't refunded: ${data.failed.join(" · ")}`);
    router.refresh();
  }

  function approve() {
    if (mode === "cards") {
      if (cardIds.length === 0) { setError("Pick at least one card."); return; }
      if (!confirm(`Refund ${formatCurrency(Math.min(cardsTotal, remainingCents))} for ${cardIds.length} card${cardIds.length === 1 ? "" : "s"} through Stripe? This can't be undone.`)) return;
      send({ action: "approve", mode, cardIds, sendEmail, note: note.trim() || undefined });
    } else {
      if (!amountCents || amountCents <= 0) { setError("Enter the amount to refund."); return; }
      if (amountCents > remainingCents) { setError(`At most ${formatCurrency(remainingCents)} is left to refund.`); return; }
      if (!confirm(`Refund ${formatCurrency(amountCents)} through Stripe? This can't be undone.`)) return;
      send({ action: "approve", mode, amountCents, sendEmail, customerMessage: customerMessage.trim() || undefined, note: note.trim() || undefined });
    }
  }

  if (status === "processing") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-semibold">This refund is being issued.</p>
        <p className="text-xs mt-1">If it stays like this, check Stripe for the refund before resetting it, so it isn&apos;t refunded twice.</p>
        <button onClick={() => confirm("Checked Stripe and no refund went out for this request?") && send({ action: "reset" })} disabled={busy} className="mt-2 text-xs font-bold underline disabled:opacity-50">
          Reset to waiting
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  const input = "h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white";

  return (
    <div className="flex flex-col gap-3">
      {lastError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Last try failed: {lastError}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("cards")} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${mode === "cards" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border"}`}>
          Refund cards
        </button>
        <button type="button" onClick={() => setMode("amount")} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${mode === "amount" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border"}`}>
          Refund an amount
        </button>
      </div>

      {mode === "cards" ? (
        <div className="flex flex-col gap-1.5">
          {cards.map((c) => (
            <label key={c.id} className={`flex flex-wrap items-center gap-2 text-sm ${c.refundableCents > 0 ? "cursor-pointer" : "text-muted-foreground"}`}>
              <input
                type="checkbox"
                className="accent-primary"
                disabled={c.refundableCents <= 0}
                checked={cardIds.includes(c.id)}
                onChange={(e) => setCardIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
              />
              <span className={c.requested ? "font-semibold" : ""}>{c.name}</span>
              {c.requested && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">requested</span>}
              <span className="text-xs text-muted-foreground">{c.refundableCents > 0 ? formatCurrency(c.refundableCents) : c.note ?? "Nothing to refund"}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Refunds each card&apos;s service fee (and slab fee if its slab wasn&apos;t opened). Total {formatCurrency(Math.min(cardsTotal, remainingCents))}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`amt-${requestId}`} className="text-sm font-semibold">Amount $</label>
            <input id={`amt-${requestId}`} className={`${input} w-32`} inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="0.00" />
            <button type="button" onClick={() => setDollars((remainingCents / 100).toFixed(2))} className="text-xs font-semibold text-primary hover:underline">
              Everything left ({formatCurrency(remainingCents)})
            </button>
          </div>
          {sendEmail && (
            <input className={input} value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} placeholder="Message in the customer's refund email (optional)" maxLength={1000} />
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-primary" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
        Email the customer a refund receipt{mode === "cards" && cardIds.length > 1 ? " (one per card)" : ""}
      </label>

      <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={denying ? "Why it's denied (support sees this) — required" : "Note for support (optional)"} maxLength={1000} />

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!denying ? (
          <>
            <button onClick={approve} disabled={busy} className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50">
              {busy ? "Refunding…" : "Approve & refund"}
            </button>
            <button onClick={() => { setDenying(true); setError(""); }} disabled={busy} className="h-9 px-4 rounded-lg border border-border text-sm font-bold text-red-600 hover:border-red-300">
              Deny
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => (note.trim() ? send({ action: "deny", note: note.trim() }) : setError("Say why, so support can tell the customer."))}
              disabled={busy}
              className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Deny request"}
            </button>
            <button onClick={() => setDenying(false)} disabled={busy} className="h-9 px-4 rounded-lg text-sm font-semibold text-muted-foreground">Back</button>
          </>
        )}
      </div>
    </div>
  );
}
