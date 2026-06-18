"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  id: string;
  name: string;
  priceCents: number;
  inventoryCount: number;
}

export function KitRow({ id, name, priceCents, inventoryCount }: Props) {
  const [count, setCount] = useState(inventoryCount);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const soldOut = count === 0;

  async function update(newCount: number) {
    setSaving(true);
    setFlash("");
    const res = await fetch("/api/admin/settings/kits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sold_out: newCount === 0, inventory_count: newCount }),
    });
    setSaving(false);
    if (res.ok) {
      setCount(newCount);
      setFlash("Saved");
      setTimeout(() => setFlash(""), 2000);
    } else {
      setFlash("Error");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(priceCents)}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Inventory count input */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Stock:</label>
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(Math.max(0, parseInt(e.target.value) || 0))}
            onBlur={() => update(count)}
            className="w-20 h-8 border border-border rounded-lg px-2 text-sm text-center focus:outline-none focus:border-primary"
          />
        </div>

        {/* Sold out toggle */}
        <button
          onClick={() => update(soldOut ? 999 : 0)}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            soldOut
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {soldOut ? "Sold Out" : "In Stock"}
        </button>

        {flash && (
          <span className={`text-xs font-semibold ${flash === "Saved" ? "text-green-600" : "text-red-500"}`}>
            {flash}
          </span>
        )}
      </div>
    </div>
  );
}
