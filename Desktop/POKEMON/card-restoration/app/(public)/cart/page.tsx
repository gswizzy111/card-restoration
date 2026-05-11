"use client";

import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";

export default function CartPage() {
  const { items, totalCents, removeItem, updateQty } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <h1 className="font-heading font-black text-2xl text-foreground mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-8">Browse the shop to add products.</p>
        <Button render={<Link href="/shop" />} className="font-bold">Browse Shop</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
      <h1 className="font-heading font-black text-3xl text-foreground mb-8">Your Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-secondary/40 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🧴</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">{item.name}</p>
                <p className="text-primary font-bold text-sm">{formatCurrency(item.price_cents)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground text-sm w-16 text-right">
                  {formatCurrency(item.price_cents * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-xl p-6 sticky top-24">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">Order Summary</h2>
            <div className="flex flex-col gap-2 text-sm mb-4">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(totalCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border text-base">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totalCents)}</span>
              </div>
            </div>
            <Button render={<Link href="/cart/checkout" />} className="w-full font-bold">
              Proceed to Checkout
            </Button>
            <Link href="/shop" className="block text-center text-sm text-muted-foreground hover:text-primary mt-3 transition-colors">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
