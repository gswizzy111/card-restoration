"use client";

import { useState } from "react";

type Address = {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

export function AddressEditor({ orderId, address }: { orderId: string; address: Address | null }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<Address>(
    address ?? { street1: "", street2: "", city: "", state: "", zip: "", country: "US" }
  );
  const [draft, setDraft] = useState<Address>(current);
  const [error, setError] = useState("");

  function patch(field: keyof Address, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/address`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping_address: draft }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setCurrent(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(current);
    setEditing(false);
    setError("");
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-sm text-muted-foreground">
          {current.street1 ? (
            <>
              <p>{current.street1}{current.street2 ? `, ${current.street2}` : ""}</p>
              <p>{current.city}, {current.state} {current.zip}{current.country && current.country !== "US" ? ` · ${current.country}` : ""}</p>
            </>
          ) : (
            <p className="italic">No address on file</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="self-start text-xs font-bold px-2 py-0.5 rounded border border-border bg-secondary hover:border-primary hover:text-primary transition-colors"
        >
          ✎ Edit Address
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1 p-3 bg-secondary/40 rounded-lg border border-border">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Edit Address</p>
      <input
        className="h-8 w-full rounded border border-input bg-white px-2.5 text-sm focus:outline-none focus:border-primary"
        placeholder="Street address"
        value={draft.street1}
        onChange={(e) => patch("street1", e.target.value)}
      />
      <input
        className="h-8 w-full rounded border border-input bg-white px-2.5 text-sm focus:outline-none focus:border-primary"
        placeholder="Apt, suite, etc. (optional)"
        value={draft.street2 ?? ""}
        onChange={(e) => patch("street2", e.target.value)}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          className="h-8 col-span-1 rounded border border-input bg-white px-2.5 text-sm focus:outline-none focus:border-primary"
          placeholder="City"
          value={draft.city}
          onChange={(e) => patch("city", e.target.value)}
        />
        <input
          className="h-8 col-span-1 rounded border border-input bg-white px-2.5 text-sm focus:outline-none focus:border-primary"
          placeholder="State"
          value={draft.state}
          onChange={(e) => patch("state", e.target.value)}
        />
        <input
          className="h-8 col-span-1 rounded border border-input bg-white px-2.5 text-sm focus:outline-none focus:border-primary"
          placeholder="ZIP"
          value={draft.zip}
          onChange={(e) => patch("zip", e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 mt-1">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
