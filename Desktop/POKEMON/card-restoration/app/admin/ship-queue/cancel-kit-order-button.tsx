"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelKitOrderButton({ orderId, customerName }: { orderId: string; customerName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm(`Cancel order for ${customerName}? This will issue a full refund through Stripe and cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/shop-orders/${orderId}/cancel`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Cancellation failed.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loading ? "Cancelling…" : "Cancel & Refund"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
