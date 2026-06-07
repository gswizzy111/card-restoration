"use client";

import { useState } from "react";

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
  existingLabelUrl?: string | null;
  existingTrackingNumber?: string | null;
  labelName?: string;
};

export function ReturnLabelButton({ orderId, existingLabelUrl, existingTrackingNumber, labelName = "Return" }: Props) {
  const [state, setState] = useState<"idle" | "fetching" | "confirm" | "purchasing" | "done" | "error">("idle");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(existingLabelUrl ?? null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(existingTrackingNumber ?? null);
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchRates() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/return-label`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get rates");
      if (data.labelUrl) {
        setLabelUrl(data.labelUrl);
        if (data.trackingNumber) setTrackingNumber(data.trackingNumber);
        setState("done");
        return;
      }
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
      setLabelUrl(data.labelUrl);
      if (data.trackingNumber) setTrackingNumber(data.trackingNumber);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  // Already have a label
  if (labelUrl) {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={labelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity w-fit"
        >
          Print {labelName} Label
        </a>
        {trackingNumber && (
          <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-lg w-fit">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">Tracking</span>
            <span className="font-mono font-semibold text-sm text-cyan-900">{trackingNumber}</span>
          </div>
        )}
      </div>
    );
  }

  if (state === "confirm" && selectedRate) {
    return (
      <div className="flex flex-col gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-bold text-blue-900">Confirm {labelName} Label</p>
        <div className="flex flex-col gap-1">
          {rates.map((r) => (
            <label key={r.objectId} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="radio"
                name={`rate-${orderId}`}
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
    );
  }

  if (state === "purchasing") {
    return <p className="text-xs text-muted-foreground mt-2">Purchasing label...</p>;
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <button
        onClick={fetchRates}
        disabled={state === "fetching"}
        className="text-xs font-bold px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg hover:border-primary/40 transition-colors disabled:opacity-50 w-fit"
      >
        {state === "fetching" ? "Getting rates..." : `Create ${labelName} Label`}
      </button>
      {state === "error" && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  );
}
