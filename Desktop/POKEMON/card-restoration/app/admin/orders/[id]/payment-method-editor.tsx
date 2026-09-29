"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "card",      label: "Credit / Debit Card" },
  { value: "gift_card", label: "Gift Card" },
  { value: "cash",      label: "Cash" },
  { value: "venmo",     label: "Venmo" },
  { value: "zelle",     label: "Zelle" },
  { value: "check",     label: "Check" },
  { value: "other",     label: "Other" },
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  OPTIONS.map((o) => [o.value, o.label])
);

export function PaymentMethodEditor({ orderId, current }: { orderId: string; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save(next: string) {
    setValue(next);
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/orders/${orderId}/payment-method`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: next || null }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
      <span className="text-xs text-muted-foreground shrink-0">Paid via</span>
      <select
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary/60 disabled:opacity-50"
      >
        <option value="">— not set —</option>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {saved && <span className="text-xs text-green-600 shrink-0">Saved</span>}
    </div>
  );
}
