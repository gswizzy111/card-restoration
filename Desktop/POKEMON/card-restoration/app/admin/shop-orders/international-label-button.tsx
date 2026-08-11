"use client";

import { useState } from "react";

interface ShippoRate {
  objectId: string;
  provider: string;
  service: string;
  amount: string;
  currency: string;
  days: number | null;
}

interface LabelEntry {
  label_url: string | null;
  customs_url: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
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
  const [rates, setRates] = useState<ShippoRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippoRate | null>(null);
  const [declaredValueCents, setDeclaredValueCents] = useState(orderValueCents);
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchRates() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/admin/shop-orders/${orderId}/international-label?declared_value_cents=${declaredValueCents}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get rates");
      setRates(data.rates);
      setSelectedRate(data.rates[0] ?? null);
      setState("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  async function bookShipment() {
    if (!selectedRate) return;
    setState("booking");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/international-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateObjectId: selectedRate.objectId }),
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

  const inp = "w-full h-8 border border-purple-300 rounded-lg px-2 text-xs focus:outline-none focus:border-purple-500 bg-white";

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* Existing international labels */}
      {labels.map((label, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-700">
              Intl Label {labels.length > 1 ? `#${i + 1}` : ""} — Shippo
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
            {label.customs_url ? (
              <a
                href={label.customs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Print Customs Invoice (PDF)
              </a>
            ) : (
              <span className="inline-block text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                Customs included in label PDF
              </span>
            )}
            {label.tracking_url && (
              <a
                href={label.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Track →
              </a>
            )}
          </div>
        </div>
      ))}

      {/* Idle — show declared value + get quotes button */}
      {state === "idle" && (
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
              Declared Value (USD)
            </label>
            <div className="flex gap-2 items-center">
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(declaredValueCents / 100).toFixed(2)}
                  onChange={(e) => setDeclaredValueCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="w-full h-8 border border-border rounded-lg pl-5 pr-2 text-xs focus:outline-none focus:border-primary bg-white"
                />
              </div>
              <button
                onClick={fetchRates}
                className="text-xs font-bold px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              >
                {labels.length === 0 ? "Get International Rates" : "+ New Label"}
              </button>
            </div>
          </div>
        </div>
      )}

      {state === "fetching" && (
        <p className="text-xs text-muted-foreground">Getting Shippo rates…</p>
      )}

      {state === "confirm" && selectedRate && (
        <div className="flex flex-col gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-xs font-bold text-purple-900 uppercase tracking-wide">Choose Service</p>

          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {rates.map((r) => (
              <label key={r.objectId} className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name={`rate-${orderId}`}
                  checked={selectedRate.objectId === r.objectId}
                  onChange={() => setSelectedRate(r)}
                  className="accent-purple-600 mt-0.5"
                />
                <span className="text-purple-800">
                  <span className="font-bold">{r.provider}</span> — {r.service}
                  {r.days ? ` · ${r.days}d` : ""}{"  "}
                  <span className="font-bold">${parseFloat(r.amount).toFixed(2)} {r.currency}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Customs invoice is generated automatically for international shipments.
          </p>

          <div className="flex gap-2 mt-1">
            <button
              onClick={bookShipment}
              className="text-xs font-bold px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Book ${parseFloat(selectedRate.amount).toFixed(2)} with Shippo
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
        <p className="text-xs text-muted-foreground">Booking with Shippo…</p>
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
