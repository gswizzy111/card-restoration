"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KIT_STATUSES = {
  paid:       { label: "Payment Received" },
  processing: { label: "Processing" },
  shipped:    { label: "Shipped" },
  delivered:  { label: "Delivered" },
} as const;

type KitStatus = keyof typeof KIT_STATUSES;

const TIMELINE: KitStatus[] = ["paid", "processing", "shipped", "delivered"];

const STATUS_COLORS: Record<KitStatus, string> = {
  paid:       "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-yellow-50 text-yellow-700 border-yellow-200",
  shipped:    "bg-purple-50 text-purple-700 border-purple-200",
  delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function KitStatusUpdater({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [status, setStatus] = useState<KitStatus>(
    (currentStatus as KitStatus) in KIT_STATUSES ? (currentStatus as KitStatus) : "paid"
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function updateStatus(newStatus: KitStatus) {
    setLoading(true);
    await fetch(`/api/admin/shop-orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatus(newStatus);
    setLoading(false);
    router.refresh();
  }

  const currentIndex = TIMELINE.indexOf(status);
  const nextStatus = TIMELINE[currentIndex + 1];

  return (
    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order Status</p>

      {/* Current badge */}
      <div className={`inline-flex self-start items-center px-3 py-1 rounded-full border text-xs font-bold ${STATUS_COLORS[status]}`}>
        {KIT_STATUSES[status].label}
      </div>

      {/* All status buttons */}
      <div className="grid grid-cols-2 gap-2">
        {TIMELINE.map((s) => (
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
            {KIT_STATUSES[s].label}
          </button>
        ))}
      </div>

      {/* Quick advance */}
      {nextStatus && (
        <button
          onClick={() => updateStatus(nextStatus)}
          disabled={loading}
          className="w-full h-10 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
        >
          {loading ? "Updating..." : `Mark as ${KIT_STATUSES[nextStatus].label} →`}
        </button>
      )}
    </div>
  );
}
