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
      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
    >
      {loading ? "Marking..." : "Mark as Shipped"}
    </button>
  );
}
