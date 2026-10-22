"use client";

import { useState } from "react";
import { SigningSection, emptySigning, signingReady, submittedSigning, type SigningState } from "@/components/checkout/signing-section";
import { CardIdentityFields, emptyIdentity, identityPayload, type CardIdentity } from "@/components/checkout/card-identity-fields";
import { HIGH_VALUE_NOTICE, SIGN_BUTTON_LABEL, VALUE_HELP } from "@/lib/legal/current-terms";
import { isHighValue } from "@/lib/legal/agreements-v1";
import { RESTORATION_TIERS } from "@/lib/restoration-tiers";
import { formatCurrency } from "@/lib/utils";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import { PhotoUploader } from "@/components/order-builder/photo-uploader";

const TAX_RATE = 0.06625;

type CardEntry = CardIdentity & {
  name: string;
  declaredValue: string;
  photoUrls: string[];
};

interface Props {
  orderNumber: string;
  customerEmail: string;
  tier: RestorationTierId;
}

function emptyCard(): CardEntry {
  return { name: "", declaredValue: "", photoUrls: [], ...emptyIdentity() };
}

const valueCents = (c: CardEntry) => Math.round((parseFloat(c.declaredValue.replace(/[^0-9.]/g, "")) || 0) * 100);

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400";

export function AddCardsSection({ orderNumber, customerEmail, tier }: Props) {
  const tierInfo = RESTORATION_TIERS[tier] ?? RESTORATION_TIERS["regular"];
  const isElite = tier === "elite";
  const priceRate = tierInfo.pricing_rate ?? 0.07;
  const maxCents = tierInfo.max_card_value_cents;

  const [cards, setCards] = useState<CardEntry[]>([emptyCard()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // The Terms of Service v1.0 signature for the added cards
  const [signing, setSigning] = useState<SigningState>(emptySigning());

  function updateCard(i: number, patch: Partial<CardEntry>) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addCard() {
    setCards((prev) => [...prev, emptyCard()]);
  }

  function removeCard(i: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  function cardPrice(card: CardEntry): number {
    if (isElite) return Math.round(valueCents(card) * priceRate);
    return tierInfo.price_cents;
  }

  const listSubtotal = cards.reduce((sum, c) => sum + cardPrice(c), 0);
  const subtotal = listSubtotal;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;
  const overCap = (c: CardEntry) => maxCents !== null && valueCents(c) > maxCents;
  const highValueCards = cards.filter((c) => isHighValue(valueCents(c))).map((c) => ({ name: c.name.trim(), valueCents: valueCents(c) }));
  const cardsOk = cards.every((c) => c.name.trim().length > 0 && valueCents(c) > 0 && !overCap(c));
  const canSubmit = cardsOk && signingReady(signing, []) && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderNumber}/add-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail,
          cards: cards.map((c) => ({ name: c.name.trim(), ...identityPayload(c), declaredValueCents: valueCents(c), photoUrls: c.photoUrls })),
          ...submittedSigning(signing, []),
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 p-6 mb-5">
      <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Add to Your Order</p>
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Add More Cards</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Add cards before we receive your shipment. Priced at your {tierInfo.name} rate
        {isElite
          ? ` (${(priceRate * 100).toFixed(0)}% of declared value)`
          : ` (${formatCurrency(tierInfo.price_cents)}/card)`}
        {maxCents !== null ? `, for cards worth up to $${(maxCents / 100).toLocaleString()}` : ""}.
      </p>

      <div className="flex flex-col gap-4">
        {cards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">Card {i + 1}</p>
              {cards.length > 1 && (
                <button
                  onClick={() => removeCard(i)}
                  disabled={loading}
                  className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Card Name *</label>
                <input
                  type="text"
                  value={card.name}
                  onChange={(e) => updateCard(i, { name: e.target.value })}
                  placeholder="e.g. Charizard"
                  disabled={loading}
                  className={inputCls}
                />
              </div>

              <CardIdentityFields idPrefix={`add-${i}`} value={card} onChange={(patch) => updateCard(i, patch)} />

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Declared Value *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={card.declaredValue}
                    onChange={(e) => updateCard(i, { declaredValue: e.target.value })}
                    disabled={loading}
                    className={`${inputCls} pl-6`}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{VALUE_HELP}</p>
                {isElite && <p className="text-xs text-muted-foreground mt-1">Service fee: {formatCurrency(cardPrice(card))}</p>}
                {overCap(card) && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    This is above the {tierInfo.name} tier&apos;s ${(maxCents! / 100).toLocaleString()} cap, so it can&apos;t be added to this order. Please place a new order for it with a higher tier.
                  </p>
                )}
                {isHighValue(valueCents(card)) && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 font-medium mt-2">{HIGH_VALUE_NOTICE}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Photos (optional)</label>
                <PhotoUploader
                  photoUrls={card.photoUrls}
                  onChange={(urls) => updateCard(i, { photoUrls: urls })}
                  max={4}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addCard}
        disabled={loading}
        className="mt-3 w-full py-2.5 border border-dashed border-green-300 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
      >
        + Add Another Card
      </button>

      <div className="mt-5 bg-green-50 rounded-lg p-4">
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
          <span>{formatCurrency(listSubtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Tax (6.625%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between font-bold text-foreground border-t border-green-200 pt-2">
          <span>Total Due</span>
          <span className="text-green-700">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg border border-border p-4 md:p-5">
        <SigningSection slabCards={[]} highValueCards={highValueCards} state={signing} onChange={setSigning} onSkipSlab={() => {}} />
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40"
      >
        {loading ? "Redirecting to checkout…" : SIGN_BUTTON_LABEL}
      </button>
    </div>
  );
}
