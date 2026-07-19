"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESTORATION_TIERS, getAllTiers } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TIERS = getAllTiers();

type TierOrCustom = RestorationTierId | "custom" | "";

type CardRow = { id: string; name: string; tier: TierOrCustom };

function emptyCard(defaultTier: TierOrCustom): CardRow {
  return { id: crypto.randomUUID(), name: "", tier: defaultTier };
}

function tierPrice(tier: TierOrCustom): number | null {
  if (!tier || tier === "custom") return null;
  return RESTORATION_TIERS[tier as RestorationTierId].price_cents;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ManualOrderForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [defaultTier, setDefaultTier] = useState<TierOrCustom>("");
  const [customPricePerCard, setCustomPricePerCard] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState<CardRow[]>([emptyCard("")]);

  function addCard() { setCards((p) => [...p, emptyCard(defaultTier)]); }
  function removeCard(id: string) { setCards((p) => p.filter((c) => c.id !== id)); }
  function updateCardName(id: string, value: string) {
    setCards((p) => p.map((c) => c.id === id ? { ...c, name: value } : c));
  }
  function updateCardTier(id: string, tier: TierOrCustom) {
    setCards((p) => p.map((c) => c.id === id ? { ...c, tier } : c));
  }

  function applyTierToAll(tier: TierOrCustom) {
    setDefaultTier(tier);
    setCards((p) => p.map((c) => ({ ...c, tier })));
  }

  const filledCards = cards.filter((c) => c.name.trim());
  const customPriceCents = Math.round((parseFloat(customPricePerCard.replace(/[^0-9.]/g, "")) || 0) * 100);

  function cardPriceCents(card: CardRow): number {
    const tp = tierPrice(card.tier);
    if (tp !== null) return tp;
    return customPriceCents;
  }

  const totalCents = filledCards.reduce((sum, c) => sum + cardPriceCents(c), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (filledCards.length === 0) { setError("Add at least one card."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name || undefined,
          customer_email: email || undefined,
          customer_phone: phone || undefined,
          order_date: orderDate,
          restoration_tier: (defaultTier && defaultTier !== "custom") ? defaultTier : undefined,
          price_per_card_cents: customPriceCents > 0 ? customPriceCents : undefined,
          due_date: dueDate || undefined,
          notes: notes || undefined,
          cards: filledCards.map((c) => ({
            card_name: c.name.trim(),
            tier: (c.tier && c.tier !== "custom") ? c.tier : undefined,
            price_per_card_cents: (tierPrice(c.tier) === null && customPriceCents > 0) ? customPriceCents : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSubmitting(false); return; }
      router.push(`/admin/orders/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const label = "block text-xs font-semibold text-muted-foreground mb-1.5";
  const select = `${input} cursor-pointer`;

  const allSameTier = filledCards.length > 0 && filledCards.every((c) => c.tier === filledCards[0].tier);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">

      {/* Customer — all optional */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-base text-foreground">Customer</h2>
          <span className="text-xs text-muted-foreground">All optional</span>
        </div>
        <div>
          <label className={label}>Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Email</label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>
        </div>
      </div>

      {/* Order Date */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Order Date</h2>
        <div>
          <label className={label}>Date Taken <span className="text-muted-foreground font-normal">(for backdating)</span></label>
          <input className={input} type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
        </div>
      </div>

      {/* Tier — applies to all cards */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Service Tier</h2>
        <div>
          <label className={label}>Apply to all cards</label>
          <select className={select} value={defaultTier} onChange={(e) => applyTierToAll(e.target.value as TierOrCustom)}>
            <option value="">— No Tier / Custom Price —</option>
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {fmt(t.price_cents)}/card
              </option>
            ))}
            <option value="custom">Custom Price</option>
          </select>
        </div>
        {(defaultTier === "custom" || defaultTier === "") && (
          <div>
            <label className={label}>Custom Price per Card <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                className={`${input} pl-7`}
                type="number"
                min="0"
                step="0.01"
                value={customPricePerCard}
                onChange={(e) => setCustomPricePerCard(e.target.value)}
                placeholder="75.00"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-base text-foreground">Cards</h2>
          <button type="button" onClick={addCard} className="text-sm font-semibold text-primary hover:text-primary/80">
            + Add Card
          </button>
        </div>
        {cards.map((card, i) => {
          const price = cardPriceCents(card);
          return (
            <div key={card.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{i + 1}.</span>
                <input
                  className={`${input} flex-1`}
                  value={card.name}
                  onChange={(e) => updateCardName(card.id, e.target.value)}
                  placeholder="Card name (e.g. Charizard Base Set)"
                />
                {cards.length > 1 && (
                  <button type="button" onClick={() => removeCard(card.id)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
                )}
              </div>
              <div className="flex items-center gap-2 pl-8">
                <select
                  className="flex-1 h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary transition-colors bg-white cursor-pointer"
                  value={card.tier}
                  onChange={(e) => updateCardTier(card.id, e.target.value as TierOrCustom)}
                >
                  <option value="">— Inherit from order —</option>
                  {TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {fmt(t.price_cents)}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {price > 0 && (
                  <span className="text-xs font-semibold text-primary shrink-0">{fmt(price)}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        {filledCards.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
            <span className="text-sm text-muted-foreground">
              {filledCards.length} card{filledCards.length !== 1 ? "s" : ""}
              {allSameTier && filledCards[0].tier && filledCards[0].tier !== "custom" && (
                <span className="ml-1 text-xs">({RESTORATION_TIERS[filledCards[0].tier as RestorationTierId]?.name})</span>
              )}
            </span>
            <span className="text-xl font-black text-foreground">{totalCents > 0 ? fmt(totalCents) : "—"}</span>
          </div>
        )}
      </div>

      {/* Due Date */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Timeline</h2>
        <div>
          <label className={label}>Due Date <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-2">
        <label className="font-heading font-black text-base text-foreground">Notes <span className="text-muted-foreground font-normal text-sm">(optional)</span></label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors bg-white resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Special instructions, context, etc."
        />
      </div>

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex justify-between">
        <a href="/admin" className="h-10 px-5 border border-border rounded-lg text-sm font-semibold text-foreground flex items-center hover:bg-secondary transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="h-10 px-8 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>
    </form>
  );
}
