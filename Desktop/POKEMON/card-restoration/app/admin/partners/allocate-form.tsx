"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AllocateForm({ partnerId, current }: { partnerId: string; current: number }) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/partners/${partnerId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kits_allocated: value }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">Allocate Kits</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value) || 0)}
        className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={save}
        disabled={saving || value === current}
        className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving..." : "Update"}
      </button>
    </div>
  );
}
