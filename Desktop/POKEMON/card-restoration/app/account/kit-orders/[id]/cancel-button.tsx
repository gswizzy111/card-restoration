"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelButton({ orderId }: { orderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/account/kit-orders/${orderId}/cancel`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please contact us.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 font-semibold">
        ✓ Cancellation request submitted. We&apos;ll process your refund shortly.
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
      >
        Cancel Subscription
      </button>
    );
  }

  return (
    <div className="border border-red-200 rounded-xl p-4 bg-red-50 flex flex-col gap-3">
      <p className="text-sm font-semibold text-red-800">Are you sure you want to cancel?</p>
      <p className="text-xs text-red-700">This will submit a cancellation request. Refunds are handled within 1–2 business days.</p>
      {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Processing…" : "Yes, Cancel"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-border text-foreground hover:bg-secondary transition-colors"
        >
          Keep Subscription
        </button>
      </div>
    </div>
  );
}
