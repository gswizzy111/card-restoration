"use client";

import { useState } from "react";

export function RegenerateLabelButton({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handle() {
    if (!confirm("Generate a new inbound shipping label for this order? This will create a new Shippo transaction.")) return;
    setStatus("loading");
    const res = await fetch(`/api/admin/orders/${orderId}/regenerate-label`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMsg(data.error ?? "Failed to regenerate label.");
    } else {
      setStatus("done");
      setMsg("Label generated! Refreshing…");
      setTimeout(() => window.location.reload(), 1200);
    }
  }

  if (status === "done") return <p className="text-xs text-green-700 font-semibold mt-1">{msg}</p>;

  return (
    <div className="mt-1">
      <button
        onClick={handle}
        disabled={status === "loading"}
        className="text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 disabled:opacity-50"
      >
        {status === "loading" ? "Generating…" : "Regenerate label →"}
      </button>
      {status === "error" && <p className="text-xs text-red-600 mt-1">{msg}</p>}
    </div>
  );
}
