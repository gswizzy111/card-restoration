"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  partnerId: string;
  kits: number;
  polish: number;
  spray: number;
};

export function AllocateForm({ partnerId, kits, polish, spray }: Props) {
  const [kitsVal, setKitsVal] = useState(kits);
  const [polishVal, setPolishVal] = useState(polish);
  const [sprayVal, setSprayVal] = useState(spray);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const unchanged = kitsVal === kits && polishVal === polish && sprayVal === spray;

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/partners/${partnerId}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kits_allocated: kitsVal,
        polish_allocated: polishVal,
        spray_allocated: sprayVal,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {[
        { label: "Kits", value: kitsVal, set: setKitsVal },
        { label: "Polish", value: polishVal, set: setPolishVal },
        { label: "Spray", value: sprayVal, set: setSprayVal },
      ].map(({ label, value, set }) => (
        <div key={label} className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => set(parseInt(e.target.value) || 0)}
            className="w-16 border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving || unchanged}
        className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Saving..." : "Update"}
      </button>
    </div>
  );
}
