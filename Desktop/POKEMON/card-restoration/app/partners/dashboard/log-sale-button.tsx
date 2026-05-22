"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogSaleButton({ remaining }: { remaining: number }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partners/kit-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOpen(false);
      setQuantity(1);
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
        disabled={remaining <= 0}
        className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
      >
        Log Kit Sale
      </button>
    );
  }

  return (
    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-blue-900">Log Kit Sale</p>
      <div className="flex items-center gap-3">
        <label className="text-sm text-blue-800 shrink-0">Quantity sold</label>
        <input
          type="number"
          min={1}
          max={remaining}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        />
        <span className="text-xs text-blue-700">of {remaining} remaining</span>
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm Sale"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm px-4 py-2 text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}
