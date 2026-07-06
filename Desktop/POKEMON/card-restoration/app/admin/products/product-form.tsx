"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ProductCostsConfig } from "@/lib/product-costs";

const CATEGORIES = ["Cleaning", "Tools", "Storage", "Kits"];

interface ProductFormProps {
  initial?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price_cents: number;
    category: string;
    inventory_count: number;
    active: boolean;
    images: string[];
    weight_oz: number;
  };
}

export function ProductForm({ initial }: ProductFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    price: initial ? (initial.price_cents / 100).toFixed(2) : "",
    category: initial?.category ?? "Cleaning",
    inventory: initial?.inventory_count?.toString() ?? "0",
    active: initial?.active ?? true,
    weight_oz: initial?.weight_oz?.toString() ?? "4",
  });
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);

  // Cost breakdown
  const [components, setComponents] = useState<Array<{ name: string; cost_str: string }>>([]);
  const [costsSaving, setCostsSaving] = useState(false);

  useEffect(() => {
    if (!initial?.id) return;
    fetch("/api/admin/product-costs")
      .then((r) => r.json())
      .then((config: ProductCostsConfig) => {
        const entry = config.products[initial.id];
        if (entry?.components?.length) {
          setComponents(entry.components.map((c) => ({ name: c.name, cost_str: (c.cost_cents / 100).toFixed(2) })));
        }
      })
      .catch(() => {});
  }, [initial?.id]);

  // Upsell toggle — stored separately in storage config, not in DB column
  const [isUpsell, setIsUpsell] = useState(false);
  const [upsellSaving, setUpsellSaving] = useState(false);

  useEffect(() => {
    if (!initial?.id) return;
    fetch("/api/shop/upsell-products/ids")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.ids)) setIsUpsell(d.ids.includes(initial.id));
      })
      .catch(() => {});
  }, [initial?.id]);

  async function handleUpsellToggle(enabled: boolean) {
    if (!initial?.id) return;
    setIsUpsell(enabled);
    setUpsellSaving(true);
    try {
      const res = await fetch("/api/admin/products/upsell-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: initial.id, enabled }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success(enabled ? "Added to checkout upsell" : "Removed from checkout upsell");
    } catch {
      setIsUpsell(!enabled); // revert
      toast.error("Failed to update upsell setting");
    }
    setUpsellSaving(false);
  }

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setImageUrls((prev) => [...prev, data.url]);
      else toast.error(data.error ?? "Upload failed");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.name || !form.slug || !form.price || !form.category) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      price_cents: Math.round(parseFloat(form.price) * 100),
      category: form.category,
      inventory_count: parseInt(form.inventory) || 0,
      active: form.active,
      images: imageUrls,
      weight_oz: parseFloat(form.weight_oz) || 4,
    };

    const url = initial ? `/api/admin/products/${initial.id}` : "/api/admin/products";
    const [res] = await Promise.all([
      fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      initial?.id ? saveCosts(initial.id) : Promise.resolve(),
    ]);
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      toast.success(initial ? "Product updated!" : "Product created!");
      router.push("/admin/products");
      router.refresh();
    } else {
      toast.error(data.error ?? "Failed to save.");
    }
  }

  async function saveCosts(productId: string) {
    const validComponents = components
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), cost_cents: Math.round(parseFloat(c.cost_str || "0") * 100) }));
    const cost_cents = validComponents.reduce((s, c) => s + c.cost_cents, 0);

    setCostsSaving(true);
    const config: ProductCostsConfig = await fetch("/api/admin/product-costs").then((r) => r.json()).catch(() => ({ products: {}, restoration: { regular_cents: 0, expedited_cents: 0, premium_cents: 0, ultra_premium_cents: 0 } }));
    config.products[productId] = { components: validComponents, cost_cents };
    await fetch("/api/admin/product-costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    setCostsSaving(false);
  }

  const totalCogs = components.reduce((s, c) => s + (parseFloat(c.cost_str || "0") || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Product Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              if (!initial) set("slug", autoSlug(e.target.value));
            }}
            placeholder="Card Cleaning Spray"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Slug *</Label>
          <Input value={form.slug} onChange={(e) => set("slug", autoSlug(e.target.value))} placeholder="card-cleaning-spray" />
          <p className="text-xs text-muted-foreground">URL: /shop/{form.slug || "..."}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Describe the product..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Price (USD) *</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="17.99" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Inventory</Label>
            <Input type="number" value={form.inventory} onChange={(e) => set("inventory", e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Category *</Label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Weight (oz)</Label>
            <Input type="number" step="0.1" value={form.weight_oz} onChange={(e) => set("weight_oz", e.target.value)} placeholder="4" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="active"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <Label htmlFor="active">Visible in shop</Label>
        </div>
        {initial?.id && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_upsell"
              checked={isUpsell}
              disabled={upsellSaving}
              onChange={(e) => handleUpsellToggle(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <Label htmlFor="is_upsell" className={upsellSaving ? "opacity-50" : ""}>
              Show in checkout upsell {upsellSaving && "(saving…)"}
            </Label>
          </div>
        )}
      </div>

      {/* Images */}
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-black text-lg text-foreground mb-4">Product Images</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
              <button
                onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer">
          {uploading ? "Uploading..." : "+ Add Images"}
          <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </label>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading font-black text-lg text-foreground">Cost Breakdown (COGS)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">List every item that goes into this product so P&amp;L can calculate your profit.</p>
          </div>
          {totalCogs > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="font-heading font-black text-xl text-red-600">${totalCogs.toFixed(2)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {components.map((comp, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                placeholder="Item name (e.g. Cleaning solution)"
                value={comp.name}
                onChange={(e) => setComponents((prev) => prev.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                className="flex-1"
              />
              <div className="relative w-28 flex-shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={comp.cost_str}
                  onChange={(e) => setComponents((prev) => prev.map((c, j) => j === i ? { ...c, cost_str: e.target.value } : c))}
                  className="pl-6"
                />
              </div>
              <button
                onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              >×</button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setComponents((prev) => [...prev, { name: "", cost_str: "" }])}
          className="text-sm text-primary font-medium hover:underline"
        >
          + Add component
        </button>

        {initial?.id && components.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            {form.price && totalCogs > 0 && (
              <div className="flex-1 text-sm text-muted-foreground">
                Margin: <span className="font-bold text-foreground">${(parseFloat(form.price) - totalCogs).toFixed(2)}</span>
                {" "}({Math.round(((parseFloat(form.price) - totalCogs) / parseFloat(form.price)) * 100)}%)
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => saveCosts(initial.id)} disabled={costsSaving}>
              {costsSaving ? "Saving..." : "Save Costs"}
            </Button>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="font-bold h-12">
        {saving ? "Saving..." : initial ? "Save Changes" : "Create Product"}
      </Button>
    </div>
  );
}
