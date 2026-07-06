"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProductCostsConfig } from "@/lib/product-costs";

const TIERS = [
  { key: "regular_cents" as const, label: "Regular" },
  { key: "expedited_cents" as const, label: "Expedited" },
  { key: "premium_cents" as const, label: "Premium" },
  { key: "ultra_premium_cents" as const, label: "Ultra Premium" },
];

export function CostSettings({ initial }: { initial: ProductCostsConfig }) {
  const [costs, setCosts] = useState(() =>
    Object.fromEntries(TIERS.map((t) => [t.key, ((initial.restoration[t.key] ?? 0) / 100).toFixed(2)]))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const config: ProductCostsConfig = await fetch("/api/admin/product-costs").then((r) => r.json());
      config.restoration = Object.fromEntries(
        TIERS.map((t) => [t.key, Math.round(parseFloat(costs[t.key] || "0") * 100)])
      ) as unknown as ProductCostsConfig["restoration"];
      const res = await fetch("/api/admin/product-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!(await res.json()).ok) throw new Error();
      toast.success("Restoration costs saved");
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Supply Costs</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Enter your average cost in supplies per restoration order for each tier. Used to calculate profit on restoration services.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {TIERS.map((t) => (
          <div key={t.key} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t.label}</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costs[t.key]}
                onChange={(e) => setCosts((prev) => ({ ...prev, [t.key]: e.target.value }))}
                className="pl-6"
              />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving} variant="outline">
        {saving ? "Saving..." : "Save Restoration Costs"}
      </Button>
    </div>
  );
}
