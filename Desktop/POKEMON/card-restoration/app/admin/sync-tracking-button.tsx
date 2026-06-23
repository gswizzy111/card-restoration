"use client";

import { useState } from "react";

type SyncResult = {
  updated: number;
  noMatch: number;
  noLabel: number;
  results?: { order_number: string; tracking: string | null; status: string }[];
  message?: string;
};

export function SyncTrackingButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/sync-return-tracking", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
      setState("done");
    } catch (err) {
      console.error(err);
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-green-800 mb-2">
          Sync complete — {result.updated} order{result.updated !== 1 ? "s" : ""} updated
        </p>
        {result.noMatch > 0 && (
          <p className="text-green-700 mb-1">
            {result.noMatch} label{result.noMatch !== 1 ? "s" : ""} couldn&apos;t be matched in Shippo — tracking number may need to be entered manually.
          </p>
        )}
        {result.noLabel > 0 && (
          <p className="text-green-700">
            {result.noLabel} order{result.noLabel !== 1 ? "s" : ""} had no Shippo label — tracking must be entered manually on the order page.
          </p>
        )}
        {result.results && result.results.filter(r => r.status === "updated").map((r) => (
          <p key={r.order_number} className="text-xs font-mono text-green-700 mt-1">
            #{r.order_number} → {r.tracking}
          </p>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "loading"}
      className="text-sm font-bold px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
    >
      {state === "loading" ? "Syncing from Shippo…" : "Sync Missing Tracking Numbers"}
    </button>
  );
}
