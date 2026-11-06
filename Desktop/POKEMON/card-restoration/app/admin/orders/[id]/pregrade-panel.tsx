"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pregrade = {
  selected: boolean;
  result: string | null;
  notes: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
};

/**
 * A card's pre-grade on the admin order page: mark the card as one of the
 * order's paid pre-grades, then enter and send its estimated grade.
 */
export function PregradePanel({ cardId, pregrade }: { cardId: string; pregrade: Pregrade }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState(pregrade.result ?? "");
  const [notes, setNotes] = useState(pregrade.notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function send(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/pregrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (action === "submit" || action === "resend") {
        setMessage(data.emailed ? "Emailed to the customer." : "Saved, but the email didn't send. Try Resend to customer.");
      }
      if (action === "edit") setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!pregrade.selected) {
    return (
      <button
        onClick={() => send("flag", { selected: true })}
        disabled={busy !== null}
        className="text-xs font-semibold text-indigo-700 hover:underline underline-offset-2 disabled:opacity-50"
      >
        {busy ? "…" : "+ This card has a pre-grade"}
      </button>
    );
  }

  const submitted = !!pregrade.submittedAt;
  const inputCls = "w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Pre-Grade</p>
        {submitted ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Submitted</span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">Not submitted</span>
        )}
      </div>

      {submitted && !editing ? (
        <>
          <p className="text-lg font-heading font-black text-foreground">{pregrade.result}</p>
          {pregrade.notes && <p className="text-sm text-foreground whitespace-pre-wrap">{pregrade.notes}</p>}
          <p className="text-xs text-muted-foreground">
            Submitted by {pregrade.submittedBy ?? "admin"} · {new Date(pregrade.submittedAt!).toLocaleString("en-US", { timeZone: "America/New_York" })}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setEditing(true)} className="text-xs font-semibold text-indigo-700 hover:underline underline-offset-2">Edit</button>
            <button onClick={() => send("resend")} disabled={busy !== null} className="text-xs font-semibold text-indigo-700 hover:underline underline-offset-2 disabled:opacity-50">
              {busy === "resend" ? "Sending…" : "Resend to customer"}
            </button>
          </div>
        </>
      ) : (
        <>
          <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="Estimated grade, e.g. PSA 8–9" className={inputCls} maxLength={100} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the customer (optional)" rows={2} className={`${inputCls} resize-none`} maxLength={2000} />
          <div className="flex items-center gap-3 flex-wrap">
            {submitted ? (
              <>
                <button onClick={() => send("edit", { result, notes })} disabled={busy !== null || !result.trim()}
                  className="h-8 px-4 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {busy === "edit" ? "Saving…" : "Save (no email)"}
                </button>
                <button onClick={() => { setEditing(false); setResult(pregrade.result ?? ""); setNotes(pregrade.notes ?? ""); }} className="text-xs text-muted-foreground hover:underline">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => send("submit", { result, notes })} disabled={busy !== null || !result.trim()}
                  className="h-8 px-4 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {busy === "submit" ? "Sending…" : "Submit Pre-Grade"}
                </button>
                <button onClick={() => send("flag", { selected: false })} disabled={busy !== null} className="text-xs text-muted-foreground hover:underline disabled:opacity-50">
                  Not this card
                </button>
              </>
            )}
          </div>
          {!submitted && <p className="text-[11px] text-indigo-700">Submitting emails the customer their result.</p>}
        </>
      )}
      {message && <p className="text-xs text-green-700 font-semibold">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
