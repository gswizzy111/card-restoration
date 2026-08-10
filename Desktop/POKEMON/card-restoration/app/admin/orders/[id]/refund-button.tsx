"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  orderId: string;
  totalCents: number;
  alreadyRefundedCents: number;
}

export function RefundButton({ orderId, totalCents, alreadyRefundedCents }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialDollars, setPartialDollars] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const maxRefundable = totalCents - alreadyRefundedCents;
  const isFullyRefunded = maxRefundable <= 0;

  if (isFullyRefunded) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 font-semibold bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <span>✓ Fully Refunded</span>
        <span className="font-normal text-green-600">({formatCurrency(alreadyRefundedCents)})</span>
      </div>
    );
  }

  async function handleRefund() {
    const partialCents = mode === "partial"
      ? Math.round(parseFloat(partialDollars.replace(/[^0-9.]/g, "")) * 100)
      : null;

    if (mode === "partial" && (!partialCents || partialCents <= 0)) {
      setMessage("Enter a valid refund amount.");
      setStatus("error");
      return;
    }
    if (mode === "partial" && partialCents! > maxRefundable) {
      setMessage(`Max refundable is ${formatCurrency(maxRefundable)}.`);
      setStatus("error");
      return;
    }

    const label = mode === "full" ? formatCurrency(maxRefundable) : formatCurrency(partialCents!);
    if (!confirm(`Issue a ${label} refund to this customer through Stripe? This cannot be undone.`)) return;

    setStatus("loading");
    setMessage("");

    const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: mode === "partial" ? partialCents : undefined,
        reason: reason.trim() || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Refund failed. Check the Stripe dashboard.");
    } else {
      setStatus("success");
      setMessage(`✓ Refund of ${formatCurrency(data.amountCents)} issued. Stripe ID: ${data.refundId}`);
      setOpen(false);
      window.location.reload();
    }
  }

  return (
    <div>
      {alreadyRefundedCents > 0 && (
        <p className="text-xs text-amber-700 font-semibold mb-2">
          Partial refund already issued: {formatCurrency(alreadyRefundedCents)} · {formatCurrency(maxRefundable)} remaining
        </p>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
        >
          Issue Refund
        </button>
      ) : (
        <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50 flex flex-col gap-3">
          <p className="font-semibold text-red-800 text-sm">Issue Refund — Max {formatCurrency(maxRefundable)}</p>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="refund-mode" checked={mode === "full"} onChange={() => setMode("full")} className="accent-red-600" />
              Full refund ({formatCurrency(maxRefundable)})
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="refund-mode" checked={mode === "partial"} onChange={() => setMode("partial")} className="accent-red-600" />
              Partial amount
            </label>
          </div>

          {mode === "partial" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min={0.01}
                max={maxRefundable / 100}
                step={0.01}
                value={partialDollars}
                onChange={(e) => setPartialDollars(e.target.value)}
                placeholder={`0 – ${(maxRefundable / 100).toFixed(2)}`}
                className="w-36 h-9 border border-red-300 rounded-lg px-3 text-sm focus:outline-none focus:border-red-500 bg-white"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reason (internal note, optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer not satisfied, duplicate charge, etc."
              className="w-full h-9 border border-red-300 rounded-lg px-3 text-sm focus:outline-none focus:border-red-500 bg-white"
            />
          </div>

          {status === "error" && <p className="text-sm text-red-700 font-semibold">{message}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleRefund}
              disabled={status === "loading"}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {status === "loading" ? "Processing…" : "Confirm Refund"}
            </button>
            <button
              onClick={() => { setOpen(false); setStatus("idle"); setMessage(""); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "success" && <p className="text-sm text-green-700 font-semibold mt-2">{message}</p>}
    </div>
  );
}
