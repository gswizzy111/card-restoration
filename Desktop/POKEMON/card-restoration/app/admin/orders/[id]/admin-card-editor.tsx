"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Card {
  id: string;
  card_name: string;
  card_set: string | null;
  card_year: string | null;
  estimated_value_cents: number | null;
  notes: string | null;
}

export function AdminCardEditor({ card }: { card: Card }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(card.card_name);
  const [set, setSet] = useState(card.card_set ?? "");
  const [year, setYear] = useState(card.card_year ?? "");
  const [valueStr, setValueStr] = useState(
    card.estimated_value_cents ? (card.estimated_value_cents / 100).toFixed(2) : ""
  );
  const [notes, setNotes] = useState(card.notes ?? "");

  function handleCancel() {
    setName(card.card_name);
    setSet(card.card_set ?? "");
    setYear(card.card_year ?? "");
    setValueStr(card.estimated_value_cents ? (card.estimated_value_cents / 100).toFixed(2) : "");
    setNotes(card.notes ?? "");
    setError("");
    setOpen(false);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Card name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: name.trim(),
          card_set: set.trim() || null,
          card_year: year.trim() || null,
          estimated_value_cents: valueStr ? Math.round(parseFloat(valueStr) * 100) : null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  const inp = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white transition-colors";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-1"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground">Edit Card</p>
        <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Card Name *</label>
        <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Charizard" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Set</label>
          <input className={inp} value={set} onChange={(e) => setSet(e.target.value)} placeholder="e.g. Base Set" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Year</label>
          <input className={inp} value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1999" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Estimated Value ($)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <input
            className={`${inp} pl-7`}
            type="number"
            min="0"
            step="0.01"
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white resize-none transition-colors"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this card..."
        />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Card"}
      </button>
    </div>
  );
}
