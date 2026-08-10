"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "./photo-uploader";
import type { Service, CardEntry } from "@/lib/types";
import { getAllTiers, formatCents } from "@/lib/restoration-tiers";
import type { RestorationTier, RestorationTierId } from "@/lib/restoration-tiers";

const ALL_TIERS = getAllTiers();

// Colors matching tier-selection page
const TIER_STYLES: Record<string, { selected: string; normal: string }> = {
  regular:       { selected: "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400",   normal: "border-border text-muted-foreground hover:border-amber-400 hover:bg-amber-50/40" },
  expedited:     { selected: "border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-400",  normal: "border-border text-muted-foreground hover:border-slate-400 hover:bg-slate-50/40" },
  premium:       { selected: "border-yellow-500 bg-yellow-50 text-yellow-900 ring-2 ring-yellow-400",normal: "border-border text-muted-foreground hover:border-yellow-400 hover:bg-yellow-50/40" },
  ultra_premium: { selected: "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-400",       normal: "border-border text-muted-foreground hover:border-blue-400 hover:bg-blue-50/40" },
  elite:         { selected: "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400",normal: "border-border text-muted-foreground hover:border-purple-400 hover:bg-purple-50/40" },
  fast_pass:     { selected: "border-orange-500 bg-orange-50 text-orange-900 ring-2 ring-orange-400",normal: "border-border text-muted-foreground hover:border-orange-400 hover:bg-orange-50/40" },
};

function parseCents(str: string): number {
  const val = parseFloat(str.replace(/[$,]/g, ""));
  return isNaN(val) ? 0 : Math.round(val * 100);
}

function tierAvailable(tier: RestorationTier, estimatedValueCents: number): boolean {
  if (estimatedValueCents === 0) return true;
  if (tier.max_card_value_cents === null) return true;
  return estimatedValueCents <= tier.max_card_value_cents;
}

interface StepCardsProps {
  cards: CardEntry[];
  services: Service[];
  selectedServiceIds: string[];
  onChange: (cards: CardEntry[]) => void;
  defaultTier?: RestorationTierId;
}

export function StepCards({ cards, services, selectedServiceIds, onChange, defaultTier }: StepCardsProps) {
  const availableServices = services.filter((s) => selectedServiceIds.includes(s.id));

  function updateCard(id: string, patch: Partial<CardEntry>) {
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCard() {
    const newCard: CardEntry = {
      id: crypto.randomUUID(),
      card_name: "",
      card_set: "",
      card_year: "",
      card_number: "",
      estimated_value: "",
      notes: "",
      photo_urls: [],
      service_ids: [...selectedServiceIds],
      tier: defaultTier,
    };
    onChange([...cards, newCard]);
  }

  function removeCard(id: string) {
    onChange(cards.filter((c) => c.id !== id));
  }

  function toggleService(cardId: string, serviceId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const has = card.service_ids.includes(serviceId);
    updateCard(cardId, {
      service_ids: has
        ? card.service_ids.filter((s) => s !== serviceId)
        : [...card.service_ids, serviceId],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
          Tell us about your cards.
        </h2>
        <p className="text-muted-foreground">
          Add each card you&apos;re sending. You can assign different services to different cards.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {cards.map((card, i) => {
          const estimatedValueCents = parseCents(card.estimated_value ?? "");
          const activeTierId = card.tier ?? defaultTier;
          const activeTier = activeTierId ? ALL_TIERS.find((t) => t.id === activeTierId) : null;

          return (
            <div key={card.id} className="border border-border rounded-lg p-5 flex flex-col gap-4 bg-card">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Card {i + 1}</h3>
                {cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor={`name-${card.id}`}>Card Name *</Label>
                  <Input
                    id={`name-${card.id}`}
                    placeholder="e.g. 1986 Fleer Michael Jordan"
                    value={card.card_name}
                    onChange={(e) => updateCard(card.id, { card_name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`set-${card.id}`}>Set / Year</Label>
                  <Input
                    id={`set-${card.id}`}
                    placeholder="e.g. Base Set"
                    value={card.card_set}
                    onChange={(e) => updateCard(card.id, { card_set: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`num-${card.id}`}>Card Number</Label>
                  <Input
                    id={`num-${card.id}`}
                    placeholder="e.g. #57"
                    value={card.card_number}
                    onChange={(e) => updateCard(card.id, { card_number: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`value-${card.id}`}>Estimated Value (USD)</Label>
                    {activeTier && (
                      <span className="text-xs text-muted-foreground">
                        {activeTier.max_card_value_cents === null
                          ? `${activeTier.name}: no max value`
                          : `${activeTier.name} max: $${(activeTier.max_card_value_cents / 100).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <Input
                    id={`value-${card.id}`}
                    placeholder="e.g. 500"
                    value={card.estimated_value}
                    onChange={(e) => updateCard(card.id, { estimated_value: e.target.value })}
                  />
                  {activeTier && activeTier.max_card_value_cents !== null && estimatedValueCents > activeTier.max_card_value_cents && (
                    <p className="text-xs text-red-600 font-semibold">
                      ⚠ This value exceeds the {activeTier.name} tier&apos;s max of ${(activeTier.max_card_value_cents / 100).toLocaleString()}. Please select a higher tier below.
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor={`notes-${card.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${card.id}`}
                    placeholder="Describe condition issues, areas of concern, or special instructions"
                    value={card.notes}
                    onChange={(e) => updateCard(card.id, { notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              {/* Per-card tier selector */}
              <div className="flex flex-col gap-2">
                <Label>Service Level</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_TIERS.map((t) => {
                    const selected = (card.tier ?? defaultTier) === t.id;
                    const available = tierAvailable(t, estimatedValueCents);
                    const styles = TIER_STYLES[t.id] ?? TIER_STYLES.regular;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!available}
                        onClick={() => available && updateCard(card.id, { tier: t.id as RestorationTierId })}
                        title={!available && t.max_card_value_cents ? `Requires cards under $${(t.max_card_value_cents / 100).toLocaleString()}` : undefined}
                        className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                          !available
                            ? "border-border bg-gray-50 text-gray-300 opacity-40 cursor-not-allowed"
                            : selected
                            ? styles.selected
                            : styles.normal
                        }`}
                      >
                        <span className="block font-semibold">
                          {selected && <span className="mr-1">✓</span>}{t.name}
                          {!available && t.max_card_value_cents && (
                            <span className="ml-1 text-xs font-normal">(max ${(t.max_card_value_cents / 100).toLocaleString()})</span>
                          )}
                        </span>
                        <span className="text-xs">
                          {t.pricing_type === "percentage"
                            ? `${((t.pricing_rate ?? 0) * 100).toFixed(0)}% of value`
                            : `${formatCents(t.price_cents)}/card`}
                          {" · "}
                          {t.turnaround_label ?? `${t.turnaround_min_days}–${t.turnaround_max_days} days`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Services */}
              {availableServices.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Label>Services to apply</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableServices.map((s) => {
                      const active = card.service_ids.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(card.id, s.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            active
                              ? "bg-accent text-accent-foreground border-accent"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Photos — required */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Photos <span className="text-red-500 font-bold">*</span>
                    <span className="ml-1 text-xs font-normal text-muted-foreground">Required</span>
                  </Label>
                  {card.photo_urls.length > 0 && (
                    <span className="text-xs text-green-600 font-semibold">✓ {card.photo_urls.length} photo{card.photo_urls.length !== 1 ? "s" : ""} added</span>
                  )}
                </div>
                <PhotoUploader
                  photoUrls={card.photo_urls}
                  onChange={(urls) => updateCard(card.id, { photo_urls: urls })}
                />
                {card.photo_urls.length === 0 && (
                  <p className="text-xs text-red-500">Please upload at least one photo of your card before continuing.</p>
                )}
              </div>

              {/* Slab cracking */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id={`slab-${card.id}`}
                  checked={card.needs_slab_crack ?? false}
                  onChange={(e) => updateCard(card.id, { needs_slab_crack: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-amber-600 flex-shrink-0"
                />
                <label htmlFor={`slab-${card.id}`} className="text-sm cursor-pointer">
                  <span className="font-semibold text-amber-900">Need your slab cracked? +$7</span>
                  <span className="block text-amber-700 text-xs mt-0.5">
                    Check this if your card is currently in a PSA, BGS, or other graded slab and needs to be removed before restoration.
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addCard}
        className="self-start gap-2"
      >
        <Plus className="h-4 w-4" />
        Add another card
      </Button>
    </div>
  );
}
