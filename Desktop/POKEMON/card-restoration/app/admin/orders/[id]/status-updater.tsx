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

export function StatusUpdater({
  orderId,
  currentStatus,
  currentTrackingNumber,
}: {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string | null;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber ?? "");
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingTracking, setPendingTracking] = useState("");
  const router = useRouter();

  async function updateStatus(newStatus: string, tracking?: string) {
    setLoading(true);
    await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, tracking_number: tracking ?? undefined }),
    });
    setStatus(newStatus);
    if (tracking) setTrackingNumber(tracking);
    setPendingStatus(null);
    setPendingTracking("");
    setLoading(false);
    router.refresh();
  }

  function handleStatusClick(newStatus: string) {
    if (newStatus === "shipped_back") {
      setPendingStatus("shipped_back");
      setPendingTracking("");
    } else {
      updateStatus(newStatus);
    }
  }

  const currentIndex = STATUS_TIMELINE.indexOf(status as OrderStatus);
  const nextStatus = STATUS_TIMELINE[currentIndex + 1] as OrderStatus | undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Current status badge */}
      <div className={`inline-flex self-start items-center px-4 py-2 rounded-full border font-bold text-sm ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
        {ORDER_STATUSES[status as OrderStatus]?.label ?? status}
      </div>

      {/* Tracking number display */}
      {trackingNumber && (
        <div className="flex items-center gap-2 px-4 py-3 bg-cyan-50 border border-cyan-200 rounded-lg">
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-700">Tracking</span>
          <span className="font-mono text-sm font-semibold text-cyan-900">{trackingNumber}</span>
        </div>
      )}

      {/* All status buttons */}
      <div className="grid grid-cols-2 gap-2">
        {STATUS_TIMELINE.filter(s => s !== "awaiting_payment").map((s) => (
          <button
            key={s}
            onClick={() => handleStatusClick(s)}
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

      {/* Tracking number input — shown when shipping */}
      {pendingStatus === "shipped_back" && (
        <div className="border border-cyan-200 bg-cyan-50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-cyan-900">Enter tracking number before marking shipped</p>
          <input
            type="text"
            value={pendingTracking}
            onChange={(e) => setPendingTracking(e.target.value.toUpperCase())}
            placeholder="e.g. 1Z999AA10123456784"
            className="w-full h-9 border border-border rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-colors bg-white"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setPendingStatus(null); setPendingTracking(""); }}
              className="flex-1 h-9 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => updateStatus("shipped_back", pendingTracking.trim() || undefined)}
              disabled={loading}
              className="flex-1 h-9 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Confirm Shipped"}
            </button>
          </div>
        </div>
      )}

      {/* Quick advance button */}
      {nextStatus && pendingStatus === null && (
        <button
          onClick={() => handleStatusClick(nextStatus)}
          disabled={loading}
          className="w-full h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Updating..." : `Mark as ${ORDER_STATUSES[nextStatus]?.label} →`}
        </button>
      )}
    </div>
  );
}
