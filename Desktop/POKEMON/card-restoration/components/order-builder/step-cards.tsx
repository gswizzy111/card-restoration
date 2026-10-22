"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "./photo-uploader";
import { CardIdentityFields, emptyIdentity, type CardIdentity } from "@/components/checkout/card-identity-fields";
import { HIGH_VALUE_NOTICE, VALUE_HELP } from "@/lib/legal/current-terms";
import { isHighValue } from "@/lib/legal/agreements-v1";
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

function identityOf(c: CardEntry): CardIdentity {
  return {
    card_set: c.card_set ?? "",
    card_year: c.card_year ?? "",
    card_number: c.card_number ?? "",
    variation: c.variation ?? "",
    grading_company: c.grading_company ?? "",
    grade: c.grade ?? "",
    cert_number: c.cert_number ?? "",
    known_defects: c.known_defects ?? "",
  };
}

/** A card is ready when it has a name, photos and a value within its tier's cap; a slab to open also needs its cert. */
export function cardProblems(c: CardEntry, defaultTier?: RestorationTierId): string[] {
  const problems: string[] = [];
  const value = parseCents(c.estimated_value ?? "");
  const tier = ALL_TIERS.find((t) => t.id === (c.tier ?? defaultTier));
  if (!c.card_name.trim()) problems.push("name");
  if (c.photo_urls.length === 0) problems.push("photos");
  if (value <= 0) problems.push("value");
  if (tier && tier.max_card_value_cents !== null && value > tier.max_card_value_cents) problems.push("tier");
  if (c.needs_slab_crack && (!c.grading_company || !c.cert_number?.trim())) problems.push("cert");
  return problems;
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
      ...emptyIdentity(),
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

                <div className="sm:col-span-2">
                  <CardIdentityFields
                    idPrefix={`card-${card.id}`}
                    value={identityOf(card)}
                    onChange={(patch) => updateCard(card.id, patch)}
                    needsCert={card.needs_slab_crack}
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`value-${card.id}`}>Declared value (USD) *</Label>
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
                    inputMode="decimal"
                    value={card.estimated_value}
                    onChange={(e) => updateCard(card.id, { estimated_value: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{VALUE_HELP}</p>
                  {activeTier && activeTier.max_card_value_cents !== null && estimatedValueCents > activeTier.max_card_value_cents && (
                    <p className="text-xs text-red-600 font-semibold">
                      ⚠ This value exceeds the {activeTier.name} tier&apos;s max of ${(activeTier.max_card_value_cents / 100).toLocaleString()}. Please select a higher tier below.
                    </p>
                  )}
                  {isHighValue(estimatedValueCents) && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 font-medium">{HIGH_VALUE_NOTICE}</p>
                  )}
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor={`notes-${card.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${card.id}`}
                    placeholder="Special instructions or areas of concern"
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
                  <p className="text-xs text-red-500 font-medium">Upload at least one photo to continue.</p>
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

              {/* Pregrade */}
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id={`pregrade-${card.id}`}
                  checked={card.needs_pregrade ?? false}
                  onChange={(e) => updateCard(card.id, { needs_pregrade: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-green-600 flex-shrink-0"
                />
                <label htmlFor={`pregrade-${card.id}`} className="text-sm cursor-pointer">
                  <span className="font-semibold text-green-900">Add Pregrade? +$25</span>
                  <span className="block text-green-700 text-xs mt-0.5">
                    We'll pregrade your card before submitting so you know what grade to expect — helping you decide whether to send it off.
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
