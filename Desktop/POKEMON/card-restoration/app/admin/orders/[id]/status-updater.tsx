"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, STATUS_TIMELINE, type OrderStatus } from "@/lib/constants";

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600 border-gray-200",
  awaiting_cards: "bg-yellow-50 text-yellow-700 border-yellow-200",
  received: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  shipped_back: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export function StatusUpdater({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus);
    setLoading(false);
    router.refresh();
  }

  const currentIndex = STATUS_TIMELINE.indexOf(status as OrderStatus);
  const nextStatus = STATUS_TIMELINE[currentIndex + 1] as OrderStatus | undefined;
  const prevStatus = STATUS_TIMELINE[currentIndex - 1] as OrderStatus | undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Current status badge */}
      <div className={`inline-flex self-start items-center px-4 py-2 rounded-full border font-bold text-sm ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
        {ORDER_STATUSES[status as OrderStatus]?.label ?? status}
      </div>

      {/* All status buttons */}
      <div className="grid grid-cols-2 gap-2">
        {STATUS_TIMELINE.filter(s => s !== "awaiting_payment").map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            disabled={loading || s === status}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              s === status
                ? `${STATUS_COLORS[s]} cursor-default`
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {ORDER_STATUSES[s]?.label}
          </button>
        ))}
      </div>

      {/* Quick advance button */}
      {nextStatus && (
        <button
          onClick={() => updateStatus(nextStatus)}
          disabled={loading}
          className="w-full h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Updating..." : `Mark as ${ORDER_STATUSES[nextStatus]?.label} →`}
        </button>
      )}
    </div>
  );
}
