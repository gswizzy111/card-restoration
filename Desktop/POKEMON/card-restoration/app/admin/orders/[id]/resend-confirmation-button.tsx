"use client";

import { useState } from "react";

export function ResendConfirmationButton({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("sending");
    try {
      const res = await fetch("/api/admin/orders/resend-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [orderId] }),
      });
      const data = await res.json();
      if (!res.ok || data.sent === 0) { setStatus("error"); return; }
      setStatus("done");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "sending"}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        status === "done"
          ? "bg-green-50 text-green-700 border-green-200"
          : status === "error"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      }`}
    >
      {status === "sending" ? "Sending…" : status === "done" ? "✓ Email sent" : status === "error" ? "Failed — retry" : "📧 Resend Confirmation"}
    </button>
  );
}
