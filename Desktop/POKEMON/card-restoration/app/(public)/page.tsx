import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("id, name, slug, price_cents, images, category")
    .eq("active", true)
    .limit(6)
    .order("created_at", { ascending: false });

  return (
    <>
      {/* Hero — split panel */}
      <section className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: "88vh" }}>
        {/* Left: photo / atmospheric dark */}
        <div className="hidden md:block relative bg-[#1A1714] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/card-doctor.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-15 scale-110"
          />
        </div>

        {/* Right: text panel */}
        <div className="bg-[#1A1714] flex flex-col justify-center px-10 md:px-16 py-20" style={{ minHeight: "88vh" }}>
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.3em] text-primary mb-8">
            The Card Doc
          </p>
          <h1 className="font-heading text-6xl md:text-7xl leading-[1.05] mb-6" style={{ color: "#EDE9DE" }}>
            Clean.<br />Restore.<br />Grade.
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-sm" style={{ color: "rgba(237,233,222,0.60)" }}>
            Professional card cleaning kits trusted by collectors. Everything you need to clean, restore, and prep your cards for PSA grading.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/shop"
              className="bg-primary text-primary-foreground font-semibold px-8 py-3.5 text-sm tracking-wide hover:opacity-90 transition-opacity text-center"
            >
              Shop the Kit
            </Link>
            <Link
              href="/restoration"
              className="font-semibold px-8 py-3.5 text-sm tracking-wide text-center transition-colors"
              style={{
                border: "1px solid rgba(237,233,222,0.25)",
                color: "rgba(237,233,222,0.65)",
              }}
            >
              Book Restoration
            </Link>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="bg-background py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-3">What We Sell</p>
              <h2 className="font-heading text-4xl md:text-5xl text-foreground">The Shop</h2>
            </div>
            <Link href="/shop" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>

          {(!products || products.length === 0) ? (
            <div className="border border-border py-24 text-center">
              <p className="font-heading text-xl text-muted-foreground">Products coming soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 bg-border" style={{ gap: "1px" }}>
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/shop/${product.slug}`}
                  className="bg-card group block"
                >
                  <div className="aspect-square bg-secondary overflow-hidden">
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
                  </div>
                  <div className="p-5">
                    <p className="font-heading font-bold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{product.category}</p>
                    <p className="font-semibold text-primary mt-2 text-sm">{formatCurrency(product.price_cents)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 sm:hidden text-center">
            <Link href="/shop" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              View all products
            </Link>
          </div>
        </div>
      </section>

      {/* Restoration strip */}
      <section className="bg-[#1A1714] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-3">Professional Service</p>
            <h2 className="font-heading text-3xl md:text-4xl" style={{ color: "#EDE9DE" }}>
              Restoration & PSA Prep
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: "rgba(237,233,222,0.55)" }}>
              Mail us your cards. We clean, restore, and prep them for PSA grading. $120 first card, $100 each after.
            </p>
          </div>
          <Link
            href="/restoration"
            className="shrink-0 bg-primary text-primary-foreground font-semibold px-8 py-3.5 text-sm tracking-wide hover:opacity-90 transition-opacity"
          >
            Book a Restoration
          </Link>
        </div>
      </section>
    </>
  );
}
