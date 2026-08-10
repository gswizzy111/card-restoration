"use client";

import { useState } from "react";

const CARRIERS: { label: string; value: string; trackUrl: (n: string) => string }[] = [
  { label: "USPS",   value: "USPS",   trackUrl: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { label: "UPS",    value: "UPS",    trackUrl: (n) => `https://www.ups.com/track?tracknum=${n}` },
  { label: "FedEx",  value: "FedEx",  trackUrl: (n) => `https://www.fedex.com/apps/fedextrack/?tracknumbers=${n}` },
  { label: "DHL",    value: "DHL",    trackUrl: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { label: "Other",  value: "Other",  trackUrl: (n) => `https://parcelsapp.com/en/tracking/${n}` },
];

interface Props {
  orderId: string;
  initialTracking: string | null;
  initialCarrier: string | null;
}

export function KitTrackingEditor({ orderId, initialTracking, initialCarrier }: Props) {
  const [tracking, setTracking] = useState(initialTracking ?? "");
  const [carrier, setCarrier] = useState(initialCarrier ?? "USPS");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const saved = !editing && !!tracking;
  const carrierInfo = CARRIERS.find((c) => c.value === carrier) ?? CARRIERS[0];
  const trackUrl = tracking ? carrierInfo.trackUrl(tracking.trim()) : null;

  async function save() {
    if (!tracking.trim()) return;
    setSaving(true);
    setFlash("");
    const res = await fetch(`/api/admin/shop-orders/${orderId}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracking_number: tracking.trim(), carrier }),
    });
    setSaving(false);
    if (res.ok) {
      setFlash("Saved ✓");
      setEditing(false);
      setTimeout(() => setFlash(""), 2500);
    } else {
      const data = await res.json().catch(() => ({}));
      setFlash(data.error ?? "Error saving");
    }
  }

  if (saved && !editing) {
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tracking</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{carrier}</span>
          <span className="font-mono text-sm font-semibold text-foreground">{tracking}</span>
        </div>
        {trackUrl && (
          <a
            href={trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Track package →
          </a>
        )}
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          Edit tracking
        </button>
        {flash && <p className="text-xs text-green-600 font-semibold">{flash}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tracking</p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="h-9 border border-border rounded-lg px-2 text-sm focus:outline-none focus:border-primary bg-white"
        >
          {CARRIERS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Tracking number"
          className="flex-1 min-w-0 h-9 border border-border rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-primary"
        />
        <button
          onClick={save}
          disabled={saving || !tracking.trim()}
          className="h-9 px-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {editing && (
          <button
            onClick={() => { setEditing(false); setTracking(initialTracking ?? ""); setCarrier(initialCarrier ?? "USPS"); }}
            className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {flash && (
        <p className={`text-xs font-semibold ${flash.startsWith("Saved") ? "text-green-600" : "text-red-500"}`}>{flash}</p>
      )}
    </div>
  );
}
