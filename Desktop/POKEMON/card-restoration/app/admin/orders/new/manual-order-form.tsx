"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CardRow = { id: string; name: string };

function emptyCard(): CardRow {
  return { id: crypto.randomUUID(), name: "" };
}

export function ManualOrderForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cards, setCards] = useState<CardRow[]>([emptyCard()]);
  const [pricePerCard, setPricePerCard] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  function addCard() { setCards((p) => [...p, emptyCard()]); }
  function removeCard(id: string) { setCards((p) => p.filter((c) => c.id !== id)); }
  function updateCard(id: string, value: string) {
    setCards((p) => p.map((c) => c.id === id ? { ...c, name: value } : c));
  }

  const filledCards = cards.filter((c) => c.name.trim());
  const pricePerCardCents = Math.round((parseFloat(pricePerCard.replace(/[^0-9.]/g, "")) || 0) * 100);
  const totalCents = pricePerCardCents * filledCards.length;

  function formatMoney(cents: number) {
    return cents > 0 ? `$${(cents / 100).toFixed(2)}` : "—";
  }

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
          price_per_card_cents: pricePerCardCents > 0 ? pricePerCardCents : undefined,
          due_date: dueDate || undefined,
          notes: notes || undefined,
          cards: filledCards.map((c) => ({ card_name: c.name.trim() })),
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

      {/* Cards */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-base text-foreground">Cards</h2>
          <button type="button" onClick={addCard} className="text-sm font-semibold text-primary hover:text-primary/80">
            + Add Card
          </button>
        </div>
        {cards.map((card, i) => (
          <div key={card.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{i + 1}.</span>
            <input
              className={input}
              value={card.name}
              onChange={(e) => updateCard(card.id, e.target.value)}
              placeholder="Card name (e.g. Charizard Base Set)"
            />
            {cards.length > 1 && (
              <button type="button" onClick={() => removeCard(card.id)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
            )}
          </div>
        ))}
      </div>

      {/* Pricing + Due Date */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Pricing &amp; Timeline</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Price per Card</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                className={`${input} pl-7`}
                type="number"
                min="0"
                step="0.01"
                value={pricePerCard}
                onChange={(e) => setPricePerCard(e.target.value)}
                placeholder="75.00"
              />
            </div>
          </div>
          <div>
            <label className={label}>Due Date</label>
            <input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {(filledCards.length > 0 || pricePerCardCents > 0) && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {filledCards.length} card{filledCards.length !== 1 ? "s" : ""}
              {pricePerCardCents > 0 && ` × ${formatMoney(pricePerCardCents)}`}
            </span>
            <span className="text-xl font-black text-foreground">{formatMoney(totalCents)}</span>
          </div>
        )}
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
