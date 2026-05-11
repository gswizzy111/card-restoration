import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All", "Cleaning", "Tools", "Storage", "Kits"];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("products")
    .select("id, name, slug, description, price_cents, images, category, inventory_count")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (category && category !== "All") {
    query = query.ilike("category", category);
  }

  const { data: products } = await query;

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-heading font-black text-3xl md:text-4xl text-foreground mb-2">Shop</h1>
        <p className="text-muted-foreground">Professional card cleaning supplies and tools.</p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => {
          const active = (!category && cat === "All") || category === cat;
          return (
            <a
              key={cat}
              href={cat === "All" ? "/shop" : `/shop?category=${cat}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? "bg-primary text-white border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {cat}
            </a>
          );
        })}
      </div>

      {products?.length === 0 && (
        <div className="text-center py-24 text-muted-foreground">
          <p className="text-4xl mb-4">🛍️</p>
          <p className="font-medium">Products coming soon!</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products?.map((product) => (
          <div key={product.id} className="bg-white border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all flex flex-col">
            <a href={`/shop/${product.slug}`} className="block">
              <div className="aspect-square bg-secondary/40 flex items-center justify-center">
                {product.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🧴</span>
                )}
              </div>
            </a>
            <div className="p-4 flex flex-col flex-1 gap-2">
              <a href={`/shop/${product.slug}`} className="block">
                <p className="font-heading font-black text-foreground text-sm leading-tight">{product.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{product.category}</p>
              </a>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="font-bold text-primary">{formatCurrency(product.price_cents)}</span>
                {product.inventory_count === 0 ? (
                  <span className="text-xs text-muted-foreground">Out of stock</span>
                ) : (
                  <AddToCartButton
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
