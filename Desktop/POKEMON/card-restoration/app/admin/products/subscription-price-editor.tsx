"use client";

import { useState } from "react";

export function SubscriptionPriceEditor({ initialPriceCents }: { initialPriceCents: number }) {
  const [value, setValue] = useState((initialPriceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setSaved(false);
    const cents = Math.round(parseFloat(value.replace(/[^0-9.]/g, "")) * 100);
    if (!cents || cents < 100) { setError("Enter a valid price ($1.00 minimum)."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/subscription-price", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setValue((data.price_cents / 100).toFixed(2));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaved(false); }}
            className="w-full h-9 border border-border rounded-lg pl-7 pr-3 text-sm focus:outline-none focus:border-primary bg-white"
          />
        </div>
        <span className="text-sm text-muted-foreground">/ month</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Updates what new subscribers are charged at checkout. Existing Stripe subscriptions are unaffected — change those in your Stripe dashboard.
      </p>
    </div>
  );
}
