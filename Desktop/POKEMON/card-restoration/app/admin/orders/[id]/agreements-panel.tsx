"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileDown, Hourglass, Lock, ShieldAlert } from "lucide-react";

/**
 * Terms of Service v1.0 on the admin order page: who signed what, each card's
 * work gates (Start slab opening / Start cleaning stay disabled until every
 * required signature is in place), the per-card refund before work starts,
 * and the High-Value Agreements to send, countersign or decline.
 */
export type PanelCard = {
  id: string;
  name: string;
  valueCents: number | null;
  status: string;
  slabSelected: boolean;
  cleaningStartedAt: string | null;
  cleaningBy: string | null;
  slabOpenedAt: string | null;
  slabBy: string | null;
  missing: string[];
  canStartCleaning: boolean;
  canStartSlab: boolean;
  refundableCents: number;
  nonRefundableNote: string | null;
  slabSignatureId: string | null;
};

export type PanelAgreement = {
  id: string;
  cardName: string;
  status: "pending" | "executed" | "declined";
  negotiatedTerms: string;
  sentAt: string | null;
  customerSignatureId: string | null;
  customerSigned: { name: string; at: string } | null;
  companySignedBy: string | null;
  companySignedAt: string | null;
  declinedReason: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BTN = "h-8 px-3 rounded-md text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const UNDO = "font-semibold text-primary underline underline-offset-2 hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed";

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Ready", cls: "bg-green-100 text-green-800" },
  on_hold_high_value: { label: "On hold: high value", cls: "bg-amber-100 text-amber-900" },
  in_progress: { label: "Work started", cls: "bg-blue-100 text-blue-800" },
  refunded: { label: "Refunded", cls: "bg-gray-200 text-gray-700" },
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

function AgreementBox({ a }: { a: PanelAgreement }) {
  const router = useRouter();
  const [terms, setTerms] = useState(a.negotiatedTerms);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: unknown, done: string) => {
    setBusy(true);
    try {
      await post(`/api/admin/high-value/${a.id}`, body);
      toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-foreground">High-Value Agreement: {a.cardName}</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.status === "executed" ? "bg-green-100 text-green-800" : a.status === "declined" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
          {a.status === "executed" ? "Executed" : a.status === "declined" ? "Declined" : a.customerSigned ? "Waiting for your countersignature" : "Waiting for the customer"}
        </span>
      </div>

      {a.status === "pending" && !a.customerSigned && (
        <>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor={`terms-${a.id}`}>Negotiated terms for this card (shipping, insurance, liability, price). Leave empty for none.</label>
          <textarea id={`terms-${a.id}`} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => run({ action: "save_and_send", negotiated_terms: terms }, "Agreement sent to the customer")} className={`${BTN} bg-foreground text-background`}>
              {a.sentAt ? "Save and resend" : "Save and send"} to customer
            </button>
            <span className="text-xs text-muted-foreground">{a.sentAt ? `Last sent ${when(a.sentAt)}; sending again replaces the old link.` : "Not sent yet."}</span>
          </div>
        </>
      )}

      {a.customerSigned && (
        <p className="text-foreground">
          Customer signed as <strong>{a.customerSigned.name}</strong> on {when(a.customerSigned.at)}{" "}
          {a.customerSignatureId && (
            <a href={`/api/admin/signatures/${a.customerSignatureId}`} className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-2"><FileDown className="h-3.5 w-3.5" />PDF</a>
          )}
        </p>
      )}
      {a.negotiatedTerms && a.customerSigned && <p className="text-xs text-muted-foreground whitespace-pre-wrap">Negotiated terms: {a.negotiatedTerms}</p>}

      {a.status === "pending" && a.customerSigned && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor={`cs-${a.id}`}>Your full legal name, signing for The Card Doc LLC</label>
            <input id={`cs-${a.id}`} value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-64 rounded-md border border-border bg-white px-2 text-sm" />
          </div>
          <button type="button" disabled={busy || name.trim().length < 2} onClick={() => run({ action: "countersign", signed_by: name.trim() }, "Countersigned; the card is released for work")} className={`${BTN} bg-primary text-primary-foreground`}>
            Countersign
          </button>
        </div>
      )}

      {a.status === "executed" && a.companySignedBy && a.companySignedAt && (
        <p className="text-foreground">
          Countersigned by {a.companySignedBy} on {when(a.companySignedAt)}{" "}
          {a.customerSignatureId && (
            <a href={`/api/admin/signatures/${a.customerSignatureId}?executed=1`} className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-2"><FileDown className="h-3.5 w-3.5" />Fully signed PDF</a>
          )}
        </p>
      )}
      {a.status === "declined" && <p className="text-red-800">Declined: {a.declinedReason}</p>}

      {a.status === "pending" && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Decline this card</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept on the order)" className="h-8 w-64 rounded-md border border-border bg-white px-2 text-sm" />
            <button type="button" disabled={busy || reason.trim().length < 2} onClick={() => run({ action: "decline", reason: reason.trim() }, "Marked declined")} className={`${BTN} border border-red-300 text-red-800`}>
              Decline
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

export function AgreementsPanel({
  versioned,
  master,
  insuranceElection,
  consents,
  cards,
  agreements,
}: {
  versioned: boolean;
  master: { id: string; name: string; at: string; emailVerified: boolean; version: string }[];
  insuranceElection: string | null;
  consents: { type: string; granted: boolean }[];
  cards: PanelCard[];
  agreements: PanelAgreement[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [emailRefund, setEmailRefund] = useState(true);

  async function startWork(card: PanelCard, action: "start_cleaning" | "start_slab_opening") {
    setBusy(card.id + action);
    try {
      await post(`/api/admin/cards/${card.id}/work`, { action });
      toast.success(action === "start_cleaning" ? "Cleaning started" : "Slab opening started");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  // Undoes a Start pressed by mistake (the card goes back to how it was; the undo is logged)
  async function undoWork(card: PanelCard, action: "undo_cleaning" | "undo_slab_opening") {
    const what = action === "undo_cleaning" ? "cleaning" : "slab opening";
    if (!confirm(`Undo "Start ${what}" on ${card.name}? Only do this if the ${action === "undo_cleaning" ? "cleaning hasn't actually started" : "slab hasn't actually been opened"}.`)) return;
    setBusy(card.id + action);
    try {
      await post(`/api/admin/cards/${card.id}/work`, { action });
      toast.success(`Start ${what} undone`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function refund(card: PanelCard) {
    if (!confirm(`Refund ${usd(card.refundableCents)} for ${card.name} and cancel it? This can't be undone.`)) return;
    setBusy(card.id + "refund");
    try {
      const data = await post(`/api/admin/cards/${card.id}/refund`, { sendEmail: emailRefund });
      toast.success(`Refunded ${usd(data.amountCents)}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const consent = (t: string) => consents.find((c) => c.type === t)?.granted;

  return (
    <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-5">
      <div>
        <h2 className="font-heading font-black text-lg text-foreground">Terms &amp; work gates</h2>
        <p className="text-xs text-muted-foreground mt-1">No cleaning or slab opening until every required signature is in place.</p>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        {!versioned ? (
          <p className="text-muted-foreground">Placed before Terms of Service v1.0; signed under the earlier Terms (see Signed Agreements and Activity).</p>
        ) : master.length === 0 ? (
          <p className="text-red-700 font-semibold flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" />No Terms of Service signature on file.</p>
        ) : (
          master.map((m) => (
            <p key={m.id} className="text-foreground flex flex-wrap items-center gap-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              Terms of Service v{m.version} signed by <strong>{m.name}</strong> on {when(m.at)} ({m.emailVerified ? "email verified" : "email not verified"})
              <a href={`/api/admin/signatures/${m.id}`} className="inline-flex items-center gap-1 text-primary font-semibold underline underline-offset-2"><FileDown className="h-3.5 w-3.5" />PDF</a>
            </p>
          ))
        )}
        {versioned && (
          <p className="text-xs text-muted-foreground">
            Shipping insurance: <strong className="text-foreground">{insuranceElection ?? "not recorded"}</strong> · Photos/videos: <strong className="text-foreground">{consent("marketing_media") ? "allowed" : "not allowed"}</strong> · Tag or name: <strong className="text-foreground">{consent("marketing_tag_name") ? "allowed" : "not allowed"}</strong>
          </p>
        )}
      </div>

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {cards.map((c) => {
          const s = STATUS[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-700" };
          return (
            <div key={c.id} className="py-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{c.name}</p>
                {c.valueCents != null && <span className="text-xs text-muted-foreground">{usd(c.valueCents)}</span>}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                {c.slabSelected && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground">Slab removal</span>}
              </div>
              {c.missing.length > 0 ? (
                <p className="text-xs text-red-700 font-semibold flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Missing: {c.missing.join(", ")}</p>
              ) : c.status !== "refunded" ? (
                <p className="text-xs text-green-800 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />All required signatures in place
                  {c.slabSignatureId && <a href={`/api/admin/signatures/${c.slabSignatureId}`} className="ml-1 text-primary font-semibold underline underline-offset-2">slab authorization PDF</a>}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {c.slabSelected && c.status !== "refunded" && (c.slabOpenedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Slab opened {when(c.slabOpenedAt)}{c.slabBy ? ` by ${c.slabBy}` : ""}{" "}
                    <button type="button" disabled={busy !== null} onClick={() => undoWork(c, "undo_slab_opening")} className={UNDO}>Undo</button>
                  </span>
                ) : (
                  <button type="button" disabled={!c.canStartSlab || busy !== null} onClick={() => startWork(c, "start_slab_opening")} className={`${BTN} border border-foreground/60 text-foreground`}>
                    Start slab opening
                  </button>
                ))}
                {c.cleaningStartedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Cleaning started {when(c.cleaningStartedAt)}{c.cleaningBy ? ` by ${c.cleaningBy}` : ""}
                    {c.status !== "refunded" && <>{" "}<button type="button" disabled={busy !== null} onClick={() => undoWork(c, "undo_cleaning")} className={UNDO}>Undo</button></>}
                  </span>
                ) : c.status !== "refunded" && (
                  <button type="button" disabled={!c.canStartCleaning || busy !== null} onClick={() => startWork(c, "start_cleaning")} className={`${BTN} bg-foreground text-background`}>
                    Start cleaning
                  </button>
                )}
                {c.refundableCents > 0 && (
                  <button type="button" disabled={busy !== null} onClick={() => refund(c)} className={`${BTN} border border-red-300 text-red-800 hover:bg-red-50`}>
                    Refund {usd(c.refundableCents)}{c.cleaningStartedAt ? " (unopened slab fee)" : ""}
                  </button>
                )}
                {c.nonRefundableNote && <span className="text-xs font-semibold text-muted-foreground">{c.nonRefundableNote}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {cards.some((c) => c.refundableCents > 0) && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground -mt-2">
          <input type="checkbox" checked={emailRefund} onChange={(e) => setEmailRefund(e.target.checked)} className="accent-primary" />
          Email the customer when a card is refunded
        </label>
      )}

      {agreements.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Hourglass className="h-3.5 w-3.5" />High-Value Agreements</p>
          {agreements.map((a) => <AgreementBox key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
