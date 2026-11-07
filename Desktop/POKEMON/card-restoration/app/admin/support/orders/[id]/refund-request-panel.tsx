"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PanelRequest = {
  id: string;
  scope: "order" | "cards" | "other";
  cardNames: string[];
  reason: string;
  requestedBy: string;
  createdAt: string;
  statusLabel: string;
  statusCls: string;
  /** Still waiting on an admin */
  isOpen: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type PanelCard = {
  id: string;
  name: string;
  /** Work hasn't started and it hasn't been refunded (Terms Section 11) */
  refundable: boolean;
  refunded: boolean;
};

const SCOPES = [
  { value: "order", label: "Whole order", hint: "Cancel everything and refund what's left" },
  { value: "cards", label: "Specific cards", hint: "Only cards work hasn't started on can be refunded" },
  { value: "other", label: "Something else", hint: "e.g. shipping, an add-on, a goodwill refund" },
] as const;

/**
 * Support asks an admin for a refund. They never see amounts: the admin
 * decides how much when approving (Refund Requests tab on /admin).
 */
export function RefundRequestPanel({
  orderId,
  requests,
  cards,
  canRequest,
  cannotRequestReason,
}: {
  orderId: string;
  requests: PanelRequest[];
  cards: PanelCard[];
  canRequest: boolean;
  cannotRequestReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"order" | "cards" | "other">("order");
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const hasOpen = requests.some((r) => r.isOpen);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (scope === "cards" && cardIds.length === 0) { setError("Pick the cards to refund."); return; }
    if (!reason.trim()) { setError("Say what the customer asked for and why."); return; }
    setSending(true);
    setError("");
    const res = await fetch("/api/admin/support/refund-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, scope, cardIds: scope === "cards" ? cardIds : [], reason: reason.trim() }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSending(false);
    if (!res?.ok) { setError(data?.error ?? "Could not send the request. Please try again."); return; }
    setOpen(false);
    setReason("");
    setCardIds([]);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5 sm:p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Refund requests</h2>
      <p className="text-xs text-muted-foreground mb-4">An admin reviews every request and decides the amount. Don&apos;t promise the customer a refund until it&apos;s approved.</p>

      {requests.length > 0 && (
        <ul className="flex flex-col gap-3 mb-4">
          {requests.map((r) => (
            <li key={r.id} className="border border-border rounded-lg p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.statusCls}`}>{r.statusLabel}</span>
                <span className="text-xs font-semibold text-foreground">{SCOPES.find((s) => s.value === r.scope)?.label}</span>
              </div>
              {r.cardNames.length > 0 && <p className="text-xs text-muted-foreground">Cards: {r.cardNames.join(", ")}</p>}
              <p className="text-foreground whitespace-pre-wrap mt-1">{r.reason}</p>
              <p className="text-xs text-muted-foreground mt-1">Asked by {r.requestedBy} · {r.createdAt}</p>
              {r.decidedBy && (
                <p className="text-xs mt-2 text-foreground">
                  <span className="font-semibold">{r.decidedBy}</span> · {r.decidedAt}
                  {r.decisionNote ? <>: <span className="whitespace-pre-wrap">{r.decisionNote}</span></> : null}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!canRequest ? (
        <p className="text-xs text-muted-foreground">{cannotRequestReason}</p>
      ) : hasOpen ? (
        <p className="text-xs text-muted-foreground">There&apos;s already a request waiting for an admin.</p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="h-9 px-4 rounded-lg border border-border text-sm font-bold text-foreground hover:border-primary/40">
          Request a refund
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">What should be refunded?</legend>
            {SCOPES.map((s) => (
              <label key={s.value} className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="radio" name="scope" checked={scope === s.value} onChange={() => setScope(s.value)} className="mt-1 accent-primary" />
                <span><span className="font-semibold">{s.label}</span><span className="block text-xs text-muted-foreground">{s.hint}</span></span>
              </label>
            ))}
          </fieldset>

          {scope === "cards" && (
            <div className="flex flex-col gap-1.5 pl-6">
              {cards.map((c) => (
                <label key={c.id} className={`flex items-center gap-2 text-sm ${c.refundable ? "cursor-pointer" : "text-muted-foreground"}`}>
                  <input
                    type="checkbox"
                    disabled={!c.refundable}
                    checked={cardIds.includes(c.id)}
                    onChange={(e) => setCardIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                    className="accent-primary"
                  />
                  {c.name}
                  {!c.refundable && <span className="text-xs">({c.refunded ? "already refunded" : "work started, not refundable"})</span>}
                </label>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="refund-reason" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">What did the customer ask for, and why?</label>
            <textarea
              id="refund-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer changed their mind before shipping the cards. Asked by email on Nov 7."
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white resize-y"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={sending} className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-bold disabled:opacity-50">
              {sending ? "Sending…" : "Send to an admin"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(""); }} className="h-9 px-4 rounded-lg text-sm font-semibold text-muted-foreground">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
