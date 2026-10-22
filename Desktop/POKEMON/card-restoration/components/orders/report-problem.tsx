"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { PhotoUploader } from "@/components/order-builder/photo-uploader";
import { PROBLEM_NOTICE } from "@/lib/problem-report-notice";

/** "Report a problem" on an order page (Terms Section 20). */
export function ReportProblem({ orderRef, email }: { orderRef: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/orders/${encodeURIComponent(orderRef)}/problem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, description: description.trim(), photo_urls: photos }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setError(data.error ?? "Something went wrong. Please email thecarddoc1@gmail.com."); return; }
    setSent(true);
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 mb-5">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Report a problem</h2>
      <p className="text-sm text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
        {PROBLEM_NOTICE}
      </p>
      {sent ? (
        <p className="mt-4 text-sm text-green-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Thanks. We got your report and will reply by email.</p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 h-10 px-4 rounded-md border border-foreground/60 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors">
          Report a problem
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Order <span className="font-mono">{orderRef}</span></p>
          <label htmlFor="problem-text" className="text-xs font-semibold text-muted-foreground">What happened?</label>
          <textarea
            id="problem-text"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Which card or item, what you noticed, and when it was delivered"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Photos of the item and the packaging</p>
            <PhotoUploader photoUrls={photos} onChange={setPhotos} max={6} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="button" onClick={send} disabled={busy || description.trim().length < 10} className="self-start h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40">
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
    </div>
  );
}
