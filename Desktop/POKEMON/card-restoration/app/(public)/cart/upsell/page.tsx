"use client";

import { useEffect, useState, Suspense } from "react";
import { useCart } from "@/lib/cart-context";
import { formatCurrency } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

type UpsellProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  images: string[];
  inventory_count: number;
};

function UpsellInner() {
  const { items, totalCents, addItem } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInternational = searchParams.get("international") === "true";
  const destination = isInternational ? "/cart/checkout?international=true" : "/cart/checkout";

  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/shop/upsell-products")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products ?? []);
        setLoading(false);
        // If no upsell products configured, skip straight to checkout
        if (!d.products?.length) router.replace(destination);
      })
      .catch(() => {
        setLoading(false);
        router.replace(destination);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdd(product: UpsellProduct) {
    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price_cents: product.price_cents,
      image: product.images?.[0] ?? undefined,
    });
    setAdded((prev) => ({ ...prev, [product.id]: true }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter out items already in cart
  const cartIds = new Set(items.map((i) => i.id));

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Before you check out</p>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground">Want to add anything else?</h1>
          <p className="text-muted-foreground text-sm mt-2">These pair great with your order.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left — upsell products */}
          <div className="flex-1 flex flex-col gap-4">
            {products.map((product) => {
              const inCart = cartIds.has(product.id) || added[product.id];
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border p-5 flex gap-4 items-center transition-colors ${
                    inCart ? "border-green-300 bg-green-50/40" : "border-border"
                  }`}
                >
                  {/* Image */}
                  <div className="w-20 h-20 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-secondary">
                    {product.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-black text-foreground">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
                    )}
                    <p className="text-primary font-bold text-sm mt-1">{formatCurrency(product.price_cents)}</p>
                  </div>

                  {/* Add button */}
                  <div className="flex-shrink-0">
                    {inCart ? (
                      <span className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(product)}
                        className="text-sm font-bold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right — order summary + continue */}
          <div className="lg:w-72 flex-shrink-0 sticky top-24">
            <div className="bg-white rounded-xl border border-border p-6">
              <h2 className="font-heading font-black text-lg text-foreground mb-4">Your Cart</h2>
              <div className="flex flex-col gap-2 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{item.name} × {item.quantity}</span>
                    <span className="font-medium flex-shrink-0">{formatCurrency(item.price_cents * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sales Tax (6%)</span>
                  <span className="font-medium">{formatCurrency(Math.round(totalCents * 0.06))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-xs text-muted-foreground">At checkout</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totalCents + Math.round(totalCents * 0.06))}</span>
                </div>
              </div>

              <button
                onClick={() => router.push(destination)}
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Continue to Checkout →
              </button>
              <button
                onClick={() => router.back()}
                className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpsellPage() {
  return (
    <Suspense>
      <UpsellInner />
    </Suspense>
  );
}
