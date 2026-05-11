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
      className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-base transition-colors ${
        added ? "bg-green-600 text-white" : "bg-primary text-white hover:bg-primary/90"
      }`}
    >
      <ShoppingCart className="h-5 w-5" />
      {added ? "Added to Cart!" : "Add to Cart"}
    </button>
  );
}
