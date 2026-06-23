"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncResult = {
  updated: number;
  checked: number;
  results?: { order_number: string; status: string }[];
  message?: string;
};

export function SyncDeliveredButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const router = useRouter();

  async function handleSync() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/sync-delivered", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done" && result) {
    return (
      <div className="text-sm">
        <p className="font-bold text-green-800">
          {result.updated === 0
            ? `Checked ${result.checked} orders — none newly delivered`
            : `${result.updated} order${result.updated !== 1 ? "s" : ""} marked Delivered`}
        </p>
        {result.results?.map((r) => (
          <p key={r.order_number} className="text-xs font-mono text-green-700 mt-0.5">
            #{r.order_number} → Delivered
          </p>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "loading"}
      className="text-sm font-bold px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {state === "loading" ? "Checking Shippo…" : "Sync Delivered Status"}
      {state === "error" && " (failed — retry)"}
    </button>
  );
}
