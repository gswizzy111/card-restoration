"use client";

import { useCart } from "@/lib/cart-context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap } from "lucide-react";

interface Props {
  product: {
    id: string;
    name: string;
    price_cents: number;
    slug: string;
    image?: string;
  };
}

export function AddToCartButtonLarge({ product }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const router = useRouter();

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow() {
    addItem(product);
    router.push("/cart/checkout");
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleBuyNow}
        className="w-full flex items-center justify-center gap-2 h-12 font-bold text-sm tracking-wide bg-primary text-primary-foreground hover:opacity-90 transition-opacity rounded-sm"
      >
        <Zap className="h-4 w-4" />
        Buy It Now
      </button>
      <button
        onClick={handleAdd}
        className={`w-full flex items-center justify-center gap-2 h-12 font-semibold text-sm tracking-wide border transition-colors rounded-sm ${
          added
            ? "bg-secondary text-foreground border-border"
            : "bg-transparent text-foreground border-foreground hover:bg-secondary"
        }`}
      >
        <ShoppingCart className="h-4 w-4" />
        {added ? "Added to Cart!" : "Add to Cart"}
      </button>
    </div>
  );
}
