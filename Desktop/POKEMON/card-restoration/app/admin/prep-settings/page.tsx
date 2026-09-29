"use client";

import { useEffect, useState } from "react";

interface Settings {
  prep_standard_price_cents: string;
  prep_pre_grade_price_cents: string;
  prep_slab_crack_price_cents: string;
  prep_open: string;
}

function dollarsToCents(s: string): number {
  return Math.round((parseFloat(s.replace(/[^0-9.]/g, "")) || 0) * 100);
}

function centsToDollars(cents: string): string {
  return (parseInt(cents, 10) / 100).toFixed(2);
}

export default function PrepSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [standardDollars, setStandardDollars] = useState("25.00");
  const [preGradeDollars, setPreGradeDollars] = useState("5.00");
  const [slabCrackDollars, setSlabCrackDollars] = useState("7.00");
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetch("/api/admin/prep-settings")
      .then((r) => r.json())
      .then((d: Settings) => {
        setStandardDollars(centsToDollars(d.prep_standard_price_cents));
        setPreGradeDollars(centsToDollars(d.prep_pre_grade_price_cents));
        setSlabCrackDollars(centsToDollars(d.prep_slab_crack_price_cents));
        setIsOpen(d.prep_open !== "false");
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    const standardCents = dollarsToCents(standardDollars);
    const preGradeCents = dollarsToCents(preGradeDollars);
    const slabCrackCents = dollarsToCents(slabCrackDollars);

    if (standardCents <= 0) { setError("Standard price must be greater than $0."); setSaving(false); return; }
    if (preGradeCents < 0) { setError("Pre-grade price cannot be negative."); setSaving(false); return; }
    if (slabCrackCents < 0) { setError("Slab crack price cannot be negative."); setSaving(false); return; }

    try {
      const res = await fetch("/api/admin/prep-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prep_standard_price_cents: standardCents,
          prep_pre_grade_price_cents: preGradeCents,
          prep_slab_crack_price_cents: slabCrackCents,
          prep_open: isOpen,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed.");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1.5";

  return (
    <div className="max-w-xl mx-auto p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-black text-foreground">Prep Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Adjust PSA Prep pricing and availability. Changes take effect immediately.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* Open/closed toggle */}
          <div className="bg-white rounded-xl border border-border p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading font-black text-base text-foreground">PSA Prep Status</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOpen ? "Prep is currently open — customers can place orders." : "Prep is paused — customers cannot place orders."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer focus:outline-none ${isOpen ? "bg-green-500" : "bg-red-400"}`}
                role="switch"
                aria-checked={isOpen}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform ${isOpen ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>

          {/* Prices */}
          <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-5">
            <h2 className="font-heading font-black text-base text-foreground">Pricing</h2>

            <div>
              <label className={labelCls}>Standard Prep Price (per card)</label>
              <p className="text-xs text-muted-foreground mb-2">Base price for all cards. Premium Prep = this + 2% of declared value.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  className={`${input} pl-7`}
                  value={standardDollars}
                  onChange={(e) => setStandardDollars(e.target.value)}
                  placeholder="25.00"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Pre-Grade Assessment Add-On (per card)</label>
              <p className="text-xs text-muted-foreground mb-2">Optional upcharge for grade estimation before PSA submission.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  className={`${input} pl-7`}
                  value={preGradeDollars}
                  onChange={(e) => setPreGradeDollars(e.target.value)}
                  placeholder="5.00"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Slab Crack Add-On (per card)</label>
              <p className="text-xs text-muted-foreground mb-2">Fee to crack a graded slab before prep.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  className={`${input} pl-7`}
                  value={slabCrackDollars}
                  onChange={(e) => setSlabCrackDollars(e.target.value)}
                  placeholder="7.00"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-xl border border-border p-4 text-sm">
            <p className="font-semibold text-foreground mb-2">Current pricing summary:</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              <li>Standard Prep: <strong className="text-foreground">${dollarsToCents(standardDollars) > 0 ? (dollarsToCents(standardDollars) / 100).toFixed(2) : "—"}/card</strong></li>
              <li>Premium Prep: <strong className="text-foreground">${dollarsToCents(standardDollars) > 0 ? (dollarsToCents(standardDollars) / 100).toFixed(2) : "—"} + 2% of value/card</strong></li>
              <li>Pre-Grade: <strong className="text-foreground">+${dollarsToCents(preGradeDollars) > 0 ? (dollarsToCents(preGradeDollars) / 100).toFixed(2) : "0.00"}/card</strong></li>
              <li>Slab Crack: <strong className="text-foreground">+${dollarsToCents(slabCrackDollars) > 0 ? (dollarsToCents(slabCrackDollars) / 100).toFixed(2) : "0.00"}/card</strong></li>
            </ul>
          </div>

          {error && (
            <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
          )}

          {success && (
            <div className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              ✓ Settings saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </form>
      )}
    </div>
  );
}
