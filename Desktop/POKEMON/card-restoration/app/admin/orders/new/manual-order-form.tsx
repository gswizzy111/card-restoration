"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { getPriceCents } from "@/lib/pricing";

type CardRow = { id: string; card_name: string; card_set: string; card_year: string };

function emptyCard(): CardRow {
  return { id: crypto.randomUUID(), card_name: "", card_set: "", card_year: "" };
}

export function ManualOrderForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [inboundMethod, setInboundMethod] = useState<"self_ship" | "buy_label">("self_ship");
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState<CardRow[]>([emptyCard()]);

  function updateCard(id: string, field: keyof CardRow, value: string) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  function addCard() {
    setCards((prev) => [...prev, emptyCard()]);
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  const subtotal = getPriceCents(cards.length);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filledCards = cards.filter((c) => c.card_name.trim());
    if (filledCards.length === 0) {
      setError("Add at least one card with a name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          street1,
          street2: street2 || undefined,
          city,
          state,
          zip,
          inbound_method: inboundMethod,
          notes: notes || undefined,
          cards: filledCards.map((c) => ({
            card_name: c.card_name.trim(),
            card_set: c.card_set.trim() || undefined,
            card_year: c.card_year.trim() || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }

      router.push(`/admin/orders/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputClass = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const labelClass = "block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Customer Info */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-lg text-foreground">Customer Info</h2>
          <span className="text-xs text-muted-foreground">All optional for internal records</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-lg text-foreground">Address <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Street Address</label>
            <input className={inputClass} value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Apt / Suite</label>
            <input className={inputClass} value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apt 4B" />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>ZIP</label>
            <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="10001" />
          </div>
        </div>
      </div>

      {/* Inbound Method */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-3">
        <h2 className="font-heading font-black text-lg text-foreground">Shipping Method</h2>
        <div className="flex flex-col gap-2">
          {(["self_ship", "buy_label"] as const).map((method) => (
            <label key={method} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="inbound_method"
                value={method}
                checked={inboundMethod === method}
                onChange={() => setInboundMethod(method)}
                className="accent-primary"
              />
              <span className="text-sm text-foreground font-medium">
                {method === "self_ship" ? "Customer ships themselves" : "Prepaid label (buy_label)"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-lg text-foreground">Cards</h2>
          <button
            type="button"
            onClick={addCard}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            + Add Card
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => (
            <div key={card.id} className="border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Card {i + 1}</span>
                {cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className={labelClass}>Card Name *</label>
                  <input
                    className={inputClass}
                    value={card.card_name}
                    onChange={(e) => updateCard(card.id, "card_name", e.target.value)}
                    required
                    placeholder="Charizard"
                  />
                </div>
                <div>
                  <label className={labelClass}>Set (optional)</label>
                  <input
                    className={inputClass}
                    value={card.card_set}
                    onChange={(e) => updateCard(card.id, "card_set", e.target.value)}
                    placeholder="Base Set"
                  />
                </div>
                <div>
                  <label className={labelClass}>Year (optional)</label>
                  <input
                    className={inputClass}
                    value={card.card_year}
                    onChange={(e) => updateCard(card.id, "card_year", e.target.value)}
                    placeholder="1999"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-2">
        <label className="font-heading font-black text-lg text-foreground">Notes (optional)</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors bg-white resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any special instructions or context..."
        />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">{cards.filter(c => c.card_name.trim()).length} card{cards.filter(c => c.card_name.trim()).length !== 1 ? "s" : ""} · Full Restoration & PSA Prep</p>
            <p className="text-xs text-muted-foreground mt-0.5">Marked as paid — no Stripe session created</p>
          </div>
          <p className="font-heading font-black text-2xl text-primary">{formatCurrency(subtotal)}</p>
        </div>
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
