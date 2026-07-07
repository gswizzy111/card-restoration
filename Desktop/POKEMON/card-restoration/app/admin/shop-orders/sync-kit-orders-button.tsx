"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncKitOrdersButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const router = useRouter();

  async function sync() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/sync-shop-orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState("done");
      router.refresh();
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={sync}
      disabled={state === "loading"}
      className="text-sm font-medium px-4 py-2 rounded-lg border border-border bg-white hover:bg-secondary/50 transition-colors disabled:opacity-50"
    >
      {state === "loading" ? "Syncing…" : state === "done" ? "Synced ✓" : state === "error" ? "Error — retry" : "Sync All Orders"}
    </button>
  );
}
