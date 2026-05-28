"use client";

import { useState } from "react";
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

export function ProductReorderList({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function move(index: number, direction: -1 | 1) {
    const next = [...products];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setProducts(next);
    setSaved(false);

    setSaving(true);
    await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {saving && <p className="text-xs text-muted-foreground">Saving order…</p>}
      {saved && !saving && <p className="text-xs text-green-600 font-medium">Order saved ✓</p>}

      {products.map((product, i) => (
        <div
          key={product.id}
          className="bg-white rounded-xl border border-border p-5 flex items-center gap-3"
        >
          {/* Move buttons */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0 || saving}
              className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === products.length - 1 || saving}
              className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Position number */}
          <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>

          {/* Product info — click to edit */}
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
              <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
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
  );
}
