"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkShippedButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function markShipped() {
    setLoading(true);
    await fetch(`/api/admin/shop-orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "shipped" }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={markShipped}
      disabled={loading}
      className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {loading ? "Marking..." : "Mark as Shipped"}
    </button>
  );
}
