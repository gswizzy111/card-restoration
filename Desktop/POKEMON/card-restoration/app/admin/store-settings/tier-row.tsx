"use client";

import { useState } from "react";

interface Props {
  tierId: string;
  // Effective display values (DB merged with defaults)
  name: string;
  priceCents: number;
  pricingType: "fixed" | "percentage";
  pricingRate: number;
  minCardValueCents: number | null;
  turnaroundMin: number;
  turnaroundMax: number;
  description: string;
  includesNotes: boolean;
  includesVideo: boolean;
  badge: string;
  // Availability
  isOpen: boolean;
  maxSlots: number | null;
  slotsUsed: number;
  // Whether the DB has the extended columns yet
  hasExtendedColumns: boolean;
}

export function TierRow({
  tierId,
  name,
  priceCents,
  pricingType,
  pricingRate,
  minCardValueCents,
  turnaroundMin,
  turnaroundMax,
  description,
  includesNotes,
  includesVideo,
  badge,
  isOpen,
  maxSlots,
  slotsUsed,
  hasExtendedColumns,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Availability state
  const [open, setOpen] = useState(isOpen);
  const [slots, setSlots] = useState(maxSlots !== null ? String(maxSlots) : "");
  const parsedSlots = slots === "" ? null : parseInt(slots) || null;
  const autoSoldOut = parsedSlots !== null && slotsUsed >= parsedSlots;
  const slotsLeft = parsedSlots !== null ? Math.max(0, parsedSlots - slotsUsed) : null;

  // Detail fields state
  const [displayName, setDisplayName] = useState(name);
  const [priceStr, setPriceStr] = useState((priceCents / 100).toFixed(2));
  const [rateStr, setRateStr] = useState((pricingRate * 100).toFixed(1));
  const [minValueStr, setMinValueStr] = useState(minCardValueCents ? String(minCardValueCents / 100) : "");
  const [minDays, setMinDays] = useState(String(turnaroundMin));
  const [maxDays, setMaxDays] = useState(String(turnaroundMax));
  const [desc, setDesc] = useState(description);
  const [badgeText, setBadgeText] = useState(badge);
  const [notes, setNotes] = useState(includesNotes);
  const [video, setVideo] = useState(includesVideo);

  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  async function saveAll(overrides?: { is_open?: boolean; max_slots?: number | null }) {
    setSaving(true);
    setFlash("");
    const payload: Record<string, unknown> = {
      tier: tierId,
      is_open: overrides?.is_open ?? open,
      max_slots: "max_slots" in (overrides ?? {}) ? overrides!.max_slots : parsedSlots,
      display_name: displayName.trim() || null,
      turnaround_min_days: parseInt(minDays) || null,
      turnaround_max_days: parseInt(maxDays) || null,
      description: desc.trim() || null,
      includes_notes: notes,
      includes_video: video,
      badge: badgeText.trim() || null,
    };

    if (pricingType === "fixed") {
      payload.price_cents = Math.round(parseFloat(priceStr) * 100) || null;
    } else {
      payload.pricing_rate = parseFloat(rateStr) / 100 || null;
      payload.min_card_value_cents = minValueStr ? Math.round(parseFloat(minValueStr) * 100) : null;
    }

    const res = await fetch("/api/admin/settings/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setFlash("Saved ✓");
      setTimeout(() => setFlash(""), 2500);
    } else {
      const data = await res.json().catch(() => ({}));
      setFlash(data.error ?? "Error saving");
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    saveAll({ is_open: next });
  }

  function handleSlotsBlur() {
    saveAll({ max_slots: parsedSlots });
  }

  const effectivelySoldOut = !open || autoSoldOut;

  const inp = "h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white w-full";
  const lbl = "text-xs font-semibold text-muted-foreground mb-1 block";

  return (
    <div className={`rounded-xl border transition-colors ${effectivelySoldOut ? "border-red-200 bg-red-50/30" : "border-green-200 bg-green-50/30"}`}>
      {/* Summary row — always visible */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground">{displayName || name}</p>
            {pricingType === "fixed"
              ? <span className="text-sm text-muted-foreground">${(parseFloat(priceStr) || priceCents / 100).toFixed(2)}/card</span>
              : <span className="text-sm text-muted-foreground">{parseFloat(rateStr).toFixed(1)}% of value</span>
            }
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{minDays}–{maxDays} days</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
            <span>{slotsUsed} paid order{slotsUsed !== 1 ? "s" : ""}</span>
            {slotsLeft !== null && (
              <span className={slotsLeft <= 2 ? "text-red-600 font-bold" : "text-orange-600 font-semibold"}>
                {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining
              </span>
            )}
            {autoSoldOut && <span className="text-red-600 font-bold">Auto-closed (slots full)</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {flash && (
            <span className={`text-xs font-semibold ${flash.startsWith("Saved") ? "text-green-600" : "text-red-500"}`}>
              {flash}
            </span>
          )}
          <button
            onClick={toggleOpen}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              open ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
          >
            {open ? "Open" : "Closed"}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            {expanded ? "▲ Close" : "▼ Edit"}
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-white/60 rounded-b-xl">
          {!hasExtendedColumns && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <strong>Run the database migration</strong> at the bottom of this page to unlock full tier editing.
            </div>
          )}

          {hasExtendedColumns && (
            <>
              {/* Name + Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Display Name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Badge text <span className="font-normal">(leave blank for none)</span></label>
                  <input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="e.g. Most Popular" className={inp} />
                </div>
              </div>

              {/* Price or Rate */}
              {pricingType === "fixed" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Price per card ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={priceStr}
                        onChange={(e) => setPriceStr(e.target.value)}
                        className={`${inp} pl-6`}
                      />
                    </div>
                  </div>
                  <div />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Rate (% of declared card value)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={rateStr}
                        onChange={(e) => setRateStr(e.target.value)}
                        className={`${inp} pr-8`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Min card value ($) for this tier</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        value={minValueStr}
                        onChange={(e) => setMinValueStr(e.target.value)}
                        placeholder="500"
                        className={`${inp} pl-6`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Turnaround */}
              <div>
                <label className={lbl}>Turnaround time (business days)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={minDays}
                    onChange={(e) => setMinDays(e.target.value)}
                    className="h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <input
                    type="number"
                    min={1}
                    value={maxDays}
                    onChange={(e) => setMaxDays(e.target.value)}
                    className="h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={lbl}>Description <span className="font-normal">(shown under tier name)</span></label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} className={inp} />
              </div>

              {/* Includes */}
              <div>
                <label className={lbl}>Includes</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notes}
                      onChange={(e) => setNotes(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">Grader notes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={video}
                      onChange={(e) => setVideo(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">Video showcase</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Availability */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Availability</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Max slots:</label>
                <input
                  type="number"
                  min={1}
                  value={slots}
                  placeholder="∞"
                  onChange={(e) => setSlots(e.target.value)}
                  onBlur={handleSlotsBlur}
                  className="w-20 h-8 border border-border rounded-lg px-2 text-sm text-center focus:outline-none focus:border-primary bg-white"
                />
              </div>
              <button
                onClick={toggleOpen}
                disabled={saving}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  open ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                }`}
              >
                {open ? "● Open" : "○ Closed"}
              </button>
            </div>
          </div>

          {hasExtendedColumns && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveAll()}
                disabled={saving}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
