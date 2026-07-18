"use client";

import { useCart } from "@/lib/cart-context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap } from "lucide-react";

const SIZES = ["Small", "Medium", "Large", "XL"] as const;

interface Props {
  product: {
    id: string;
    name: string;
    price_cents: number;
    slug: string;
    image?: string;
  };
  requiresSize?: boolean;
}

export function AddToCartButtonLarge({ product, requiresSize }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const router = useRouter();

  function buildItem() {
    return {
      ...product,
      id: requiresSize && size ? `${product.id}-${size}` : product.id,
      size: requiresSize && size ? size : undefined,
    };
  }

  function handleAdd() {
    if (requiresSize && !size) return;
    addItem(buildItem());
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    if (requiresSize && !size) return;
    addItem(buildItem());
    router.push("/cart/checkout");
  }

  return (
    <div className="flex flex-col gap-3">
      {requiresSize && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">Select Size</p>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`flex-1 h-10 border-2 text-sm font-semibold rounded-lg transition-all duration-150 active:scale-[0.97] ${
                  size === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {!size && (
            <p className="text-xs text-muted-foreground">Please select a size before adding to cart.</p>
          )}
        </div>
      )}

      <button
        onClick={handleBuyNow}
        disabled={requiresSize && !size}
        className="w-full flex items-center justify-center gap-2 h-13 font-bold text-sm tracking-widest uppercase bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:opacity-95 active:scale-[0.98] transition-all duration-150 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        <Zap className="h-4 w-4 fill-current" />
        Buy It Now
      </button>
      <button
        onClick={handleAdd}
        disabled={requiresSize && !size}
        className={`w-full flex items-center justify-center gap-2 h-13 font-semibold text-sm tracking-wide border-2 transition-all duration-150 rounded-xl active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
          added
            ? "bg-secondary text-foreground border-border"
            : "bg-transparent text-foreground border-foreground/70 hover:border-foreground hover:bg-secondary"
        }`}
      >
        <ShoppingCart className="h-4 w-4" />
        {added ? "Added to Cart!" : "Add to Cart"}
      </button>
    </div>
  );
}
