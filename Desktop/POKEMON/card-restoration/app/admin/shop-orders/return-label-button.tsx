"use client";

import { useState } from "react";
import type { SavedLabel } from "@/app/api/admin/shop-orders/[id]/return-label/route";

type Rate = {
  objectId: string;
  provider: string;
  service: string;
  amount: string;
  currency: string;
  days: number | null;
};

type Props = {
  orderId: string;
  existingLabels?: SavedLabel[];
  labelName?: string;
};

export function ReturnLabelButton({ orderId, existingLabels: initialLabels = [], labelName = "Shipping" }: Props) {
  const [labels, setLabels] = useState<SavedLabel[]>(initialLabels);
  const [state, setState] = useState<"idle" | "fetching" | "confirm" | "purchasing" | "error">("idle");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchRates() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/return-label`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get rates");
      setRates(data.rates);
      setSelectedRate(data.rates[0]);
      setState("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  async function purchaseLabel() {
    if (!selectedRate) return;
    setState("purchasing");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/return-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateObjectId: selectedRate.objectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");
      setLabels(data.allLabels ?? [...labels, data.newLabel]);
      setState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* Existing labels */}
      {labels.map((label, i) => (
        <div key={i} className="flex flex-col gap-1.5 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
              {labelName} Label {labels.length > 1 ? `#${i + 1}` : ""}
            </span>
            {label.createdAt && (
              <span className="text-[10px] text-cyan-600">{new Date(label.createdAt).toLocaleDateString()}</span>
            )}
          </div>
          {label.trackingNumber && (
            <p className="font-mono font-semibold text-sm text-cyan-900">{label.trackingNumber}</p>
          )}
          <a
            href={label.labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity w-fit"
          >
            Print Label
          </a>
        </div>
      ))}

      {/* Create new label */}
      {state === "idle" && (
        <button
          onClick={fetchRates}
          className="text-xs font-bold px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg hover:border-primary/40 transition-colors w-fit"
        >
          {labels.length === 0 ? `Create ${labelName} Label` : "+ Create Another Label"}
        </button>
      )}

      {state === "fetching" && (
        <p className="text-xs text-muted-foreground">Getting rates...</p>
      )}

      {state === "confirm" && selectedRate && (
        <div className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-bold text-blue-900">Choose Rate</p>
          <div className="flex flex-col gap-1">
            {rates.map((r) => (
              <label key={r.objectId} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name={`rate-${orderId}-${Date.now()}`}
                  checked={selectedRate.objectId === r.objectId}
                  onChange={() => setSelectedRate(r)}
                  className="accent-primary"
                />
                <span className="text-blue-800">
                  <span className="font-bold">{r.provider}</span> {r.service}
                  {r.days ? ` · ${r.days}d` : ""} —{" "}
                  <span className="font-bold">${parseFloat(r.amount).toFixed(2)}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={purchaseLabel}
              className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Confirm & Purchase (${parseFloat(selectedRate.amount).toFixed(2)})
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

      {state === "purchasing" && (
        <p className="text-xs text-muted-foreground">Purchasing label...</p>
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
