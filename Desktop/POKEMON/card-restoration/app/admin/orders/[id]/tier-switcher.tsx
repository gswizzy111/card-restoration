"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "prep",          label: "Prep" },
  { value: "regular",       label: "Bronze" },
  { value: "expedited",     label: "Silver" },
  { value: "premium",       label: "Gold" },
  { value: "ultra_premium", label: "Platinum" },
  { value: "elite",         label: "Diamond" },
  { value: "fast_pass",     label: "Fast Pass" },
] as const;

/** Switch the tier of the whole order, or of one card (pass cardId), e.g. prep to a restoration. */
export function TierSwitcher({ orderId, cardId, current, className, placeholder = "Restoration — no tier" }: {
  orderId: string; cardId?: string; current: string | null; className?: string; placeholder?: string;
}) {
  const value = current === "prep_standard" ? "prep" : current ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function save(next: string) {
    const label = OPTIONS.find((o) => o.value === next)?.label ?? next;
    if (!confirm(`Switch ${cardId ? "this card" : "this order"} to ${label}? The price and payment stay the same, and the customer isn't emailed.`)) return;
    setSaving(true);
    setError("");
    const res = await fetch(cardId ? `/api/admin/cards/${cardId}/tier` : `/api/admin/orders/${orderId}/tier`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: next }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) setError(data.error ?? "Failed");
    else router.refresh();
  }

  return (
    <div className={`flex items-center gap-2 ${cardId ? "" : "mt-2"}`}>
      {!cardId && <span className="text-xs text-muted-foreground shrink-0">Tier</span>}
      <select
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className={`text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/60 disabled:opacity-50 ${className ?? "border border-border bg-white"}`}
      >
        {!value && <option value="">{placeholder}</option>}
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.value === "prep" ? o.label : `${o.label} restoration`}</option>
        ))}
      </select>
      {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
