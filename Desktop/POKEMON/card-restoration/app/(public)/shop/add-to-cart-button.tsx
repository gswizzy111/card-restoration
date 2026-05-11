"use client";

import { useCart } from "@/lib/cart-context";
import { useState } from "react";

interface Props {
  product: {
    id: string;
    name: string;
    price_cents: number;
    slug: string;
    image?: string;
  };
}

export function AddToCartButton({ product }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      onClick={handleAdd}
      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
        added
          ? "bg-green-100 text-green-700"
          : "bg-primary text-white hover:bg-primary/90"
      }`}
    >
      {added ? "Added!" : "Add"}
    </button>
  );
}
