"use client";

import { useState } from "react";

export function SyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);

  async function handleSync() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/sync-shop-orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCount(data.synced);
      setState("done");
      // Reload to show new orders
      if (data.synced > 0) setTimeout(() => window.location.reload(), 1200);
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={state === "loading" || state === "done"}
      className="text-sm font-medium px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {state === "idle" && "Sync from Stripe"}
      {state === "loading" && "Syncing..."}
      {state === "done" && (count > 0 ? `Synced ${count} order${count > 1 ? "s" : ""}` : "Already up to date")}
      {state === "error" && "Error — try again"}
    </button>
  );
}
