"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rate = {
  objectId: string;
  provider: string;
  service: string;
  amount: string;
  currency: string;
  days: number | null;
};

export function ReturnLabelButton({ orderId, existingLabelUrl, insuranceType, insuranceDeclaredValueCents }: {
  orderId: string;
  existingLabelUrl?: string | null;
  insuranceType?: string | null;
  insuranceDeclaredValueCents?: number | null;
}) {
  const [state, setState] = useState<"idle" | "fetching" | "confirm" | "purchasing" | "done" | "error">("idle");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(existingLabelUrl ?? null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  if (labelUrl) {
    return (
      <a
        href={labelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        Print Return Label (PDF)
      </a>
    );
  }

  async function fetchRates() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/return-label`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get rates");
      if (data.labelUrl) { setLabelUrl(data.labelUrl); setState("done"); return; }
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
      const res = await fetch(`/api/admin/orders/${orderId}/return-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateObjectId: selectedRate.objectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");
      setLabelUrl(data.labelUrl);
      setState("done");
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  if (state === "confirm" && selectedRate) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs font-bold text-blue-900">Confirm Return Label</p>
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
            className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Confirm & Purchase (${parseFloat(selectedRate.amount).toFixed(2)})
          </button>
          <button
            onClick={() => setState("idle")}
            className="text-sm px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === "purchasing") {
    return <p className="text-sm text-muted-foreground">Purchasing label...</p>;
  }

  const hasRoundTripInsurance = insuranceType === "round_trip" && insuranceDeclaredValueCents && insuranceDeclaredValueCents > 0;

  return (
    <div className="flex flex-col gap-2">
      {hasRoundTripInsurance && (
        <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          🛡 Round-trip insurance will auto-apply (${(insuranceDeclaredValueCents / 100).toLocaleString()} declared)
        </p>
      )}
      <button
        onClick={fetchRates}
        disabled={state === "fetching"}
        className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {state === "fetching" ? "Getting rates..." : "Create Return Label"}
      </button>
      {state === "error" && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  );
}
