"use client";

import { useState } from "react";
import { formatCents } from "@/lib/restoration-tiers";

interface Props {
  tier: string;
  name: string;
  priceCents: number;
  isOpen: boolean;
  maxSlots: number | null;
  slotsUsed: number;
}

export function TierRow({ tier, name, priceCents, isOpen, maxSlots, slotsUsed }: Props) {
  const [open, setOpen] = useState(isOpen);
  const [slots, setSlots] = useState<string>(maxSlots !== null ? String(maxSlots) : "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const parsedSlots = slots === "" ? null : parseInt(slots);
  const slotsLeft = parsedSlots !== null ? Math.max(0, parsedSlots - slotsUsed) : null;
  const autoSoldOut = parsedSlots !== null && slotsUsed >= parsedSlots;

  async function save(newOpen: boolean, newMaxSlots: number | null) {
    setSaving(true);
    setFlash("");
    const res = await fetch("/api/admin/settings/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, is_open: newOpen, max_slots: newMaxSlots }),
    });
    setSaving(false);
    if (res.ok) {
      setFlash("Saved");
      setTimeout(() => setFlash(""), 2000);
    } else {
      setFlash("Error");
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    save(next, parsedSlots);
  }

  function handleSlotsBlur() {
    save(open, parsedSlots);
  }

  const effectivelySoldOut = !open || autoSoldOut;

  return (
    <div className={`p-4 rounded-xl border ${effectivelySoldOut ? "border-red-200 bg-red-50/40" : "border-green-200 bg-green-50/40"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-foreground">{name}</p>
            <span className="text-sm text-muted-foreground">{formatCents(priceCents)}/card</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{slotsUsed} paid order{slotsUsed !== 1 ? "s" : ""}</span>
            {slotsLeft !== null && (
              <span className={slotsLeft <= 2 ? "text-red-600 font-bold" : "text-orange-600 font-semibold"}>
                {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining
              </span>
            )}
            {autoSoldOut && <span className="text-red-600 font-bold">Auto-closed (slots full)</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Max slots */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Max slots:</label>
            <input
              type="number"
              min={1}
              value={slots}
              placeholder="∞"
              onChange={(e) => setSlots(e.target.value)}
              onBlur={handleSlotsBlur}
              className="w-20 h-8 border border-border rounded-lg px-2 text-sm text-center focus:outline-none focus:border-primary"
            />
          </div>

          {/* Open / Closed toggle */}
          <button
            onClick={toggleOpen}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              open
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
          >
            {open ? "Open" : "Closed"}
          </button>

          {flash && (
            <span className={`text-xs font-semibold ${flash === "Saved" ? "text-green-600" : "text-red-500"}`}>
              {flash}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
