"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncResult = {
  updated: number;
  checked: number;
  message?: string;
};

export function SyncShopDeliveredButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const router = useRouter();

  async function handleSync() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/sync-shop-delivered", { method: "POST" });
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
      <p className="text-sm font-bold text-green-800">
        {result.updated === 0
          ? `Checked ${result.checked} — none newly delivered`
          : `${result.updated} marked Delivered`}
      </p>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "loading"}
      className="text-sm font-bold px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {state === "loading" ? "Checking Shippo…" : "Sync Delivered"}
      {state === "error" && " (failed)"}
    </button>
  );
}
