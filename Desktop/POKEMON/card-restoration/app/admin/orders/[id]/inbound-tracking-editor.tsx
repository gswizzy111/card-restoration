"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InboundTrackingEditor({
  orderId,
  currentTracking,
}: {
  orderId: string;
  currentTracking: string | null;
}) {
  const [value, setValue] = useState(currentTracking ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/orders/${orderId}/inbound-tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracking_number: value.trim().toUpperCase() }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {currentTracking && (
        <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-lg">
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-700">Current</span>
          <span className="font-mono font-semibold text-sm text-cyan-900">{currentTracking}</span>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); setSaved(false); }}
          placeholder="Enter inbound tracking number"
          className="flex-1 h-9 border border-border rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={save}
          disabled={saving || !value.trim() || value.trim().toUpperCase() === currentTracking}
          className="h-9 px-4 bg-cyan-600 text-white text-sm font-bold rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">This is the tracking number on the inbound label — the one the customer uses to ship cards to you.</p>
    </div>
  );
}
