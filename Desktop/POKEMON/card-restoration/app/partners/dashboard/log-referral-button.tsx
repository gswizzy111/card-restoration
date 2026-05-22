"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogReferralButton() {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partners/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: clientName, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      setClientName("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-14 bg-white border border-border text-foreground font-bold rounded-xl hover:border-primary/40 transition-colors text-sm"
      >
        Log Referral
      </button>
    );
  }

  return (
    <div className="col-span-2 bg-secondary/40 border border-border rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-foreground">Log Referral</p>
      <input
        type="text"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder="Client name"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes — e.g. restoration, PSA prep (optional)"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Log Referral"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm px-4 py-2 text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}
