"use client";

import { useState } from "react";

interface PmQuote {
  service_id: string;
  carrier: string;
  name: string;
  price: number;
  currency: string;
  transit_days: number | null;
  customs_invoice_required: boolean;
}

interface LabelEntry {
  shipment_id: string;
  label_url: string | null;
  customs_url: string | null;
  tracking_number: string | null;
  service_id: string;
  created_at: string;
}

function todayPlusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function InternationalLabelButton({
  orderId,
  existingLabels: initialLabels = [],
  orderValueCents = 0,
}: {
  orderId: string;
  existingLabels?: LabelEntry[];
  orderValueCents?: number;
}) {
  const [labels, setLabels] = useState<LabelEntry[]>(initialLabels);
  const [state, setState] = useState<"idle" | "fetching" | "confirm" | "booking" | "error">("idle");
  const [quotes, setQuotes] = useState<PmQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<PmQuote | null>(null);
  const [collectionDate, setCollectionDate] = useState(todayPlusDays(1));
  const [declaredValue, setDeclaredValue] = useState(String((orderValueCents / 100).toFixed(2)));
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchQuotes() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/international-label`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get quotes");
      setQuotes(data.quotes);
      setSelectedQuote(data.quotes[0] ?? null);
      setState("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  async function bookShipment() {
    if (!selectedQuote) return;
    setState("booking");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/international-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedQuote.service_id,
          collection_date: collectionDate,
          customs_required: selectedQuote.customs_invoice_required,
          declared_value_cents: Math.round(parseFloat(declaredValue) * 100) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setLabels([...labels, data.result]);
      setState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* Existing international labels */}
      {labels.map((label, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-700">
              Intl Label {labels.length > 1 ? `#${i + 1}` : ""} — Parcel Monkey
            </span>
            {label.created_at && (
              <span className="text-[10px] text-purple-600">{new Date(label.created_at).toLocaleDateString()}</span>
            )}
          </div>
          {label.tracking_number && (
            <p className="font-mono font-semibold text-sm text-purple-900">{label.tracking_number}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {label.label_url && (
              <a
                href={label.label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Print Label (PDF)
              </a>
            )}
            {label.customs_url && (
              <a
                href={label.customs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Print Customs Docs (PDF)
              </a>
            )}
          </div>
        </div>
      ))}

      {/* Create new */}
      {state === "idle" && (
        <button
          onClick={fetchQuotes}
          className="text-xs font-bold px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors w-fit"
        >
          {labels.length === 0 ? "Create International Label (Parcel Monkey)" : "+ Create Another Label"}
        </button>
      )}

      {state === "fetching" && (
        <p className="text-xs text-muted-foreground">Getting Parcel Monkey rates…</p>
      )}

      {state === "confirm" && selectedQuote && (
        <div className="flex flex-col gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-xs font-bold text-purple-900 uppercase tracking-wide">Choose Service</p>

          <div className="flex flex-col gap-1.5">
            {quotes.map((q) => (
              <label key={q.service_id} className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name={`pm-rate-${orderId}`}
                  checked={selectedQuote.service_id === q.service_id}
                  onChange={() => setSelectedQuote(q)}
                  className="accent-purple-600 mt-0.5"
                />
                <span className="text-purple-800">
                  <span className="font-bold">{q.carrier}</span> — {q.name}
                  {q.transit_days ? ` · ${q.transit_days}d` : ""}{" "}
                  <span className="font-bold">${q.price.toFixed(2)} {q.currency}</span>
                  {q.customs_invoice_required && (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">Customs Required</span>
                  )}
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-purple-700 block mb-1">Collection Date</label>
              <input
                type="date"
                value={collectionDate}
                min={todayPlusDays(1)}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full h-8 border border-purple-300 rounded-lg px-2 text-xs focus:outline-none focus:border-purple-500 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-purple-700 block mb-1">Declared Value (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={declaredValue}
                onChange={(e) => setDeclaredValue(e.target.value)}
                className="w-full h-8 border border-purple-300 rounded-lg px-2 text-xs focus:outline-none focus:border-purple-500 bg-white"
              />
            </div>
          </div>

          {selectedQuote.customs_invoice_required && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This service requires customs documentation. A customs invoice PDF will be generated automatically.
            </p>
          )}

          <div className="flex gap-2 mt-1">
            <button
              onClick={bookShipment}
              className="text-xs font-bold px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Book ${selectedQuote.price.toFixed(2)} with Parcel Monkey
            </button>
            <button
              onClick={() => setState("idle")}
              className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === "booking" && (
        <p className="text-xs text-muted-foreground">Booking with Parcel Monkey…</p>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-600">{errorMsg}</p>
          <button onClick={() => setState("idle")} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}
    </div>
  );
}
