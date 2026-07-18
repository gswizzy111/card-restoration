"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

type Card = { id: string; card_name: string };
type Service = { id: string; service_name: string; price_cents: number; quantity: number };

interface Props {
  orderId: string;
  totalCents: number;
  dueDate: string | null;
  customerNotes: string | null;
  cards: Card[];
  services: Service[];
}

type CardRow = { id: string; name: string; isNew?: boolean };

export function OrderEditor({ orderId, totalCents, dueDate, customerNotes, cards, services }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Derive initial price per card from first service
  const firstService = services[0];
  const initialPricePerCard = firstService && cards.length > 0
    ? firstService.price_cents
    : Math.round(totalCents / Math.max(cards.length, 1));

  const [cardRows, setCardRows] = useState<CardRow[]>(
    cards.map((c) => ({ id: c.id, name: c.card_name }))
  );
  const [pricePerCard, setPricePerCard] = useState(
    (initialPricePerCard / 100).toFixed(2)
  );
  const [due, setDue] = useState(dueDate ?? "");
  const [notes, setNotes] = useState(customerNotes ?? "");

  function addRow() {
    setCardRows((p) => [...p, { id: crypto.randomUUID(), name: "", isNew: true }]);
  }
  function removeRow(id: string) {
    setCardRows((p) => p.filter((r) => r.id !== id));
  }
  function updateRow(id: string, name: string) {
    setCardRows((p) => p.map((r) => r.id === id ? { ...r, name } : r));
  }

  const filledCards = cardRows.filter((r) => r.name.trim());
  const pricePerCardCents = Math.round((parseFloat(pricePerCard.replace(/[^0-9.]/g, "")) || 0) * 100);
  const newTotal = pricePerCardCents * filledCards.length;

  async function handleSave() {
    setError("");
    if (filledCards.length === 0) { setError("Need at least one card."); return; }
    if (pricePerCardCents <= 0) { setError("Enter a valid price."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_per_card_cents: pricePerCardCents,
          due_date: due || null,
          notes: notes || null,
          cards: filledCards.map((r) => ({ id: r.isNew ? null : r.id, name: r.name.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  function handleCancel() {
    setCardRows(cards.map((c) => ({ id: c.id, name: c.card_name })));
    setPricePerCard((initialPricePerCard / 100).toFixed(2));
    setDue(dueDate ?? "");
    setNotes(customerNotes ?? "");
    setError("");
    setOpen(false);
  }

  const inputCn = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white transition-colors";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        Edit Order
      </button>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="font-heading font-black text-base text-foreground">Edit Order</p>
        <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">Cards</label>
          <button type="button" onClick={addRow} className="text-xs font-semibold text-primary hover:text-primary/80">+ Add</button>
        </div>
        {cardRows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
            <input
              className={inputCn}
              value={row.name}
              onChange={(e) => updateRow(row.id, e.target.value)}
              placeholder="Card name"
            />
            {cardRows.length > 1 && (
              <button type="button" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
            )}
          </div>
        ))}
      </div>

      {/* Price + Due date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Price per Card</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              className={`${inputCn} pl-7`}
              type="number"
              min="0"
              step="0.01"
              value={pricePerCard}
              onChange={(e) => setPricePerCard(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Due Date</label>
          <input className={inputCn} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Notes</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white resize-none transition-colors"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
        />
      </div>

      {/* New total preview */}
      <div className="flex items-center justify-between text-sm border-t border-amber-200 pt-3">
        <span className="text-muted-foreground">
          {filledCards.length} card{filledCards.length !== 1 ? "s" : ""}
          {pricePerCardCents > 0 && ` × ${formatCurrency(pricePerCardCents)}`}
        </span>
        <div className="flex items-center gap-3">
          {newTotal !== totalCents && (
            <span className="text-xs text-muted-foreground line-through">{formatCurrency(totalCents)}</span>
          )}
          <span className="font-black text-lg text-foreground">{formatCurrency(newTotal)}</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
