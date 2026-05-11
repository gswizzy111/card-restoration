import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";
import { AddToCartButtonLarge } from "./add-to-cart-button-large";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!product) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-12">
      <a href="/shop" className="text-sm text-muted-foreground hover:text-primary transition-colors mb-6 block">
        ← Back to Shop
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square bg-secondary/40 rounded-2xl overflow-hidden flex items-center justify-center border border-border">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-8xl">🧴</span>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2">
              {product.images.slice(1).map((url: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={product.name} className="w-16 h-16 object-cover rounded-lg border border-border" />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 capitalize">{product.category}</p>
            <h1 className="font-heading font-black text-3xl text-foreground mb-2">{product.name}</h1>
            <p className="font-heading font-black text-3xl text-primary">{formatCurrency(product.price_cents)}</p>
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          <div className="border-t border-border pt-5">
            {product.inventory_count === 0 ? (
              <p className="text-muted-foreground font-medium">Out of stock</p>
            ) : (
              <AddToCartButtonLarge
                product={{
                  id: product.id,
                  name: product.name,
                  price_cents: product.price_cents,
                  slug: product.slug,
                  image: product.images?.[0],
                }}
              />
            )}
          </div>

          {product.inventory_count > 0 && product.inventory_count <= 5 && (
            <p className="text-sm text-amber-600 font-medium">Only {product.inventory_count} left in stock</p>
          )}
        </div>
      </div>
    </div>
  );
}
