"use client";

import { useState } from "react";

export function ResendConfirmationsButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  async function handleClick() {
    if (!confirm("Resend order confirmation emails to all customers who paid today? This sends the shipping address / label to anyone whose email may have failed.")) return;
    setStatus("sending");
    setResult(null);
    try {
      const res = await fetch("/api/admin/orders/resend-confirmations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { setStatus("error"); return; }
      setResult({ sent: data.sent, failed: data.failed ?? 0 });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={status === "sending"}
        className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
      >
        {status === "sending" ? "Sending…" : "📧 Resend Today's Confirmations"}
      </button>
      {status === "done" && result && (
        <p className="text-xs text-green-600 font-semibold">
          ✓ Sent {result.sent} email{result.sent !== 1 ? "s" : ""}
          {result.failed > 0 ? ` · ${result.failed} failed` : ""}
        </p>
      )}
      {status === "error" && <p className="text-xs text-red-500">Failed — try again</p>}
    </div>
  );
}
