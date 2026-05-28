import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AddToCartButtonLarge } from "./add-to-cart-button-large";
import { RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

function DescriptionBlock({ text }: { text: string }) {
  // If description contains "includes:" pull out the items after it and render as bullets
  const match = text.match(/^(.+?includes:)\s*/i);
  if (match) {
    const itemsText = text.slice(match[0].length);
    // Split before each quantity pattern like "10x", "2x", "5×", "1×"
    const items = itemsText.split(/\s+(?=\d+[x×])/).filter(Boolean);
    if (items.length > 1) {
      return (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="text-primary font-bold shrink-0 mt-0.5">•</span>
              <span className="text-muted-foreground">{item.trim()}</span>
            </li>
          ))}
        </ul>
      );
    }
  }
  return <p className="text-muted-foreground leading-relaxed text-sm">{text}</p>;
}

const RATINGS: { keywords: string[]; stars: number; count: number }[] = [
  { keywords: ["spray"],              stars: 4.9,  count: 14 },
  { keywords: ["polish"],             stars: 4.8,  count: 18 },
  { keywords: ["clamp"],              stars: 4.95, count: 11 },
  { keywords: ["restoration", "kit"], stars: 4.97, count: 32 },
];

function getRating(name: string) {
  const lower = name.toLowerCase();
  return RATINGS.find((r) => r.keywords.some((k) => lower.includes(k)));
}

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

  const rating = getRating(product.name);

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-12">
      <a href="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 block">
        &larr; Back to Shop
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
        {/* Images */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square bg-secondary overflow-hidden">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary" />
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2">
              {product.images.slice(1).map((url: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={product.name} className="w-16 h-16 object-cover border border-border" />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-2 capitalize">
              {product.category}
            </p>
            <h1 className="font-heading text-3xl md:text-4xl text-foreground mb-3">{product.name}</h1>

            {rating && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-base tracking-tight">★★★★★</span>
                <span className="text-sm font-semibold text-foreground">{rating.stars}</span>
                <span className="text-sm text-muted-foreground">({rating.count} reviews)</span>
              </div>
            )}

            <p className="font-heading text-2xl text-primary">{formatCurrency(product.price_cents)}</p>
          </div>

          {product.description && <DescriptionBlock text={product.description} />}

          {product.inventory_count > 0 && product.inventory_count <= 5 && (
            <p className="text-sm font-medium text-primary">Only {product.inventory_count} left in stock</p>
          )}

          <div className="border-t border-border pt-6 flex flex-col gap-4">
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

            {product.name.toLowerCase().includes("kit") && (
              <Link
                href="/subscribe"
                className="w-full flex items-center justify-center gap-2 h-13 font-semibold text-sm tracking-wide border-2 border-primary text-primary hover:bg-primary/5 active:scale-[0.98] transition-all duration-150 rounded-xl"
              >
                <RefreshCw className="h-4 w-4" />
                Subscribe — $62.99/mo · Save every month
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
