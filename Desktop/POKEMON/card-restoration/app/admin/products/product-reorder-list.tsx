"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price_cents: number;
  category: string;
  inventory_count: number;
  active: boolean;
  slug: string;
}

const SECTION_ORDER = ["Kits", "Tools", "Supplies"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

function normalizeCategory(cat: string): SectionKey {
  if (cat === "Cleaning" || cat === "Storage") return "Supplies";
  if ((SECTION_ORDER as readonly string[]).includes(cat)) return cat as SectionKey;
  return "Supplies";
}

function groupBySection(products: Product[]): Record<SectionKey, Product[]> {
  const groups: Record<SectionKey, Product[]> = { Kits: [], Tools: [], Supplies: [] };
  for (const p of products) {
    groups[normalizeCategory(p.category)].push(p);
  }
  return groups;
}

export function ProductReorderList({ initialProducts }: { initialProducts: Product[] }) {
  const [sections, setSections] = useState(() => groupBySection(initialProducts));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const saveOrder = useCallback(async (updated: Record<SectionKey, Product[]>) => {
    setSaving(true);
    setSaved(false);
    const merged = SECTION_ORDER.flatMap((s) => updated[s]);
    await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: merged.map((p) => p.id) }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }, [router]);

  function move(section: SectionKey, index: number, direction: -1 | 1) {
    setSections((prev) => {
      const list = [...prev[section]];
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= list.length) return prev;
      [list[index], list[swapWith]] = [list[swapWith], list[index]];
      const updated = { ...prev, [section]: list };
      saveOrder(updated);
      return updated;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {saving && <p className="text-xs text-muted-foreground">Saving order…</p>}
      {saved && !saving && <p className="text-xs text-green-600 font-medium">Order saved ✓</p>}

      {SECTION_ORDER.map((section) => (
        <div key={section}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-heading font-black text-lg text-foreground">{section}</h2>
            <span className="text-xs text-muted-foreground">{sections[section].length} product{sections[section].length !== 1 ? "s" : ""}</span>
          </div>

          {sections[section].length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No {section.toLowerCase()} yet
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sections[section].map((product, i) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-border p-4 flex items-center gap-3"
                >
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => move(section, i, -1)}
                      disabled={i === 0 || saving}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => move(section, i, 1)}
                      disabled={i === sections[section].length - 1 || saving}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>

                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex-1 min-w-0 flex items-center gap-4 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-heading font-black text-foreground">{product.name}</p>
                        {!product.active && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Hidden</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Stock</p>
                        <p className={`font-bold ${product.inventory_count === 0 ? "text-red-600" : "text-foreground"}`}>
                          {product.inventory_count}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading font-black text-primary text-lg">{formatCurrency(product.price_cents)}</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
