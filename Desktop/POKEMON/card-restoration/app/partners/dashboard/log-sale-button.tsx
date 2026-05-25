"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProductType = "kit" | "polish" | "spray";

const PRODUCTS: { type: ProductType; label: string }[] = [
  { type: "kit",    label: "Restoration Kit" },
  { type: "polish", label: "Card Polish" },
  { type: "spray",  label: "Card Spray" },
];

type Props = {
  remainingKits: number;
  remainingPolish: number;
  remainingSpray: number;
};

export function LogSaleButton({ remainingKits, remainingPolish, remainingSpray }: Props) {
  const [open, setOpen] = useState(false);
  const [productType, setProductType] = useState<ProductType>("kit");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const remaining = productType === "kit" ? remainingKits : productType === "polish" ? remainingPolish : remainingSpray;
  const anyAvailable = remainingKits > 0 || remainingPolish > 0 || remainingSpray > 0;

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/partners/kit-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, notes, product_type: productType }),
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
        disabled={!anyAvailable}
        className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
      >
        Log a Sale
      </button>
    );
  }

  return (
    <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-blue-900">Log a Sale</p>

      {/* Product selector */}
      <div className="flex gap-2">
        {PRODUCTS.map((p) => {
          const rem = p.type === "kit" ? remainingKits : p.type === "polish" ? remainingPolish : remainingSpray;
          return (
            <button
              key={p.type}
              onClick={() => { setProductType(p.type); setQuantity(1); }}
              disabled={rem <= 0}
              className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40 ${
                productType === p.type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-blue-200 text-blue-800 hover:border-primary"
              }`}
            >
              {p.label}
              <span className="block text-[10px] font-normal opacity-70">{rem} left</span>
            </button>
          );
        })}
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-blue-800 shrink-0">Qty sold</label>
        <input
          type="number"
          min={1}
          max={remaining}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(remaining, parseInt(e.target.value) || 1)))}
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
          disabled={saving || remaining <= 0}
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
