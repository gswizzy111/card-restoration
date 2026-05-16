"use client";

import { useCart } from "@/lib/cart-context";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";

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

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleAdd}
      className={`w-full flex items-center justify-center gap-2 h-12 font-semibold text-sm tracking-wide transition-opacity ${
        added ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
      }`}
    >
      <ShoppingCart className="h-5 w-5" />
      {added ? "Added to Cart!" : "Add to Cart"}
    </button>
  );
}
