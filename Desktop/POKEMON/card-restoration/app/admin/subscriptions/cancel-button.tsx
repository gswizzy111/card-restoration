"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelSubscriptionButton({
  subscriptionId,
  customerName,
}: {
  subscriptionId: string;
  customerName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleCancel() {
    if (!confirm(`Cancel ${customerName}'s subscription? This will stop their Stripe billing immediately and cannot be undone.`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline disabled:opacity-40 transition-colors"
      >
        {loading ? "Cancelling…" : "Cancel subscription"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
