"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateKitOrderButton({ subscriptionId }: { subscriptionId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        router.refresh();
      } else {
        alert(data.error ?? "Failed to create kit order");
      }
    } catch {
      alert("Network error");
    }
    setLoading(false);
  }

  if (done) {
    return <span className="text-xs font-bold text-green-700">Kit order created ✓</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-bold px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? "Creating…" : "+ Create Kit Order"}
    </button>
  );
}
