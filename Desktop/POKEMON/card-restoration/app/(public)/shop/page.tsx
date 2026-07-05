import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { isSoldOut } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const RATINGS: { keywords: string[]; stars: number; count: number }[] = [
  { keywords: ["official"],   stars: 4.97, count: 89 },
  { keywords: ["essential"],  stars: 4.8,  count: 24 },
  { keywords: ["starter"],    stars: 4.7,  count: 51 },
  { keywords: ["clamp"],      stars: 4.9,  count: 17 },
  { keywords: ["wrinkle"],    stars: 4.85, count: 9  },
  { keywords: ["tools"],      stars: 4.75, count: 13 },
  { keywords: ["polish"],     stars: 4.8,  count: 22 },
  { keywords: ["spray"],      stars: 4.9,  count: 16 },
];

function getRating(name: string) {
  const lower = name.toLowerCase();
  return RATINGS.find((r) => r.keywords.some((k) => lower.includes(k)));
}

function StarRating({ stars, count }: { stars: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-yellow-400 text-sm tracking-tight">★★★★★</span>
      <span className="text-xs text-muted-foreground">{stars} ({count})</span>
    </div>
  );
}

const TESTIMONIALS = [
  { src: "/testimonial-1.jpeg", alt: "Customer review 1" },
  { src: "/testimonial-2.jpeg", alt: "Customer review 2" },
  { src: "/testimonial-3.jpeg", alt: "Customer review 3" },
  { src: "/testimonial-4.jpeg", alt: "Customer review 4" },
  { src: "/testimonial-5.png",  alt: "Customer review 5" },
  { src: "/testimonial-6.png",  alt: "Customer review 6" },
  { src: "/testimonial-11.png", alt: "Customer review 11" },
  { src: "/testimonial-12.png", alt: "Customer review 12" },
  { src: "/testimonial-13.png", alt: "Customer review 13" },
];

export default async function ShopPage() {
  const admin = createAdminClient();

  const { data: products } = await admin
    .from("products")
    .select("id, name, slug, description, price_cents, images, category, inventory_count")
    .eq("active", true)
    .order("display_order", { ascending: true });

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 pb-28 md:pb-14">
      {/* Header — centered */}
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-3">The Card Doc</p>
        <h1 className="font-heading text-4xl md:text-5xl text-foreground">Restoration Kits</h1>
      </div>


      {/* Empty state */}
      {products?.length === 0 && (
        <div className="border border-border py-24 text-center">
          <p className="font-heading text-xl text-muted-foreground">Products coming soon.</p>
        </div>
      )}

      {/* Product grid */}
      {products && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 bg-border" style={{ gap: "1px" }}>
          {products.map((product) => {
            const rating = getRating(product.name);
            const isKit = product.name.toLowerCase().includes("official");
            return (
              <div key={product.id} className="bg-card flex flex-col group relative">
                {isKit && (
                  <span className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow">
                    Most Popular
                  </span>
                )}
                <a href={`/shop/${product.slug}`} className="block">
                  <div className="aspect-square bg-secondary overflow-hidden relative">
                    {product.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary" />
                    )}
                    {isSoldOut() && (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.45)" }}>
                        <span
                          className="text-white font-black uppercase tracking-widest text-xs px-3 py-1 border-2 border-white rotate-[-20deg]"
                          style={{ letterSpacing: "0.2em" }}
                        >
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                </a>
                <div className="p-4 flex flex-col flex-1 gap-3">
                  <a href={`/shop/${product.slug}`} className="block flex-1">
                    <p className="font-heading font-bold text-foreground text-sm leading-tight">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{product.category}</p>
                    {rating && <StarRating stars={rating.stars} count={rating.count} />}
                  </a>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary text-sm">{formatCurrency(product.price_cents)}</span>
                    {isSoldOut() || product.inventory_count === 0 ? (
                      <span className="text-xs text-muted-foreground font-semibold">Sold Out</span>
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
            );
          })}
        </div>
      )}

      {/* Testimonials */}
      <div className="mt-20">
        <div className="mb-8 text-center">
          <p className="text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-primary mb-3">What Our Customers Say</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {TESTIMONIALS.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.src}
              src={t.src}
              alt={t.alt}
              className="w-full h-auto object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
