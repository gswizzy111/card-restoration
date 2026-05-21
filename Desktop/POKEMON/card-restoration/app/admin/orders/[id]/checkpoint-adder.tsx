"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { label: "Shipping label purchased", customerVisible: false },
  { label: "Cards received at our shop", customerVisible: true },
  { label: "Restoration in progress", customerVisible: true },
  { label: "Restoration completed", customerVisible: true },
  { label: "Return label purchased", customerVisible: false },
  { label: "Shipped back to customer", customerVisible: true },
  { label: "Package delivered", customerVisible: true },
  { label: "Custom...", customerVisible: false },
];

export function CheckpointAdder({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function selectPreset(preset: typeof PRESETS[0]) {
    if (preset.label === "Custom...") {
      setDescription("");
    } else {
      setDescription(preset.label);
    }
    setCustomerVisible(preset.customerVisible);
  }

  async function save() {
    if (!description.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, is_customer_visible: customerVisible }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDescription("");
      setCustomerVisible(false);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm font-bold py-2 px-4 border border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add Checkpoint
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-secondary/40 border border-border rounded-lg">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Add Checkpoint</p>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => selectPreset(p)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              description === p.label || (p.label === "Custom..." && !PRESETS.slice(0, -1).some(x => x.label === description))
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the checkpoint..."
        className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />

      {/* Customer visible toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={customerVisible}
          onChange={(e) => setCustomerVisible(e.target.checked)}
          className="accent-primary w-4 h-4"
        />
        <span className="text-foreground">Visible to customer</span>
        <span className="text-xs text-muted-foreground">(shows on their tracking page)</span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !description.trim()}
          className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Checkpoint"}
        </button>
        <button
          onClick={() => { setOpen(false); setDescription(""); setError(""); }}
          className="text-sm px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
