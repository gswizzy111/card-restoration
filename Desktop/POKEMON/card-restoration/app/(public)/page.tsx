import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">The Card Doc</span>
            </div>
            <h1 className="font-heading font-black text-5xl md:text-6xl text-foreground leading-[1.0] tracking-tight mb-6">
              Everything you need to<br />
              <span className="text-primary">restore your cards.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Shop professional card cleaning supplies, tools, and kits — or send your cards to us for a full restoration and PSA prep.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="text-base px-8 h-12 font-bold shadow-lg shadow-primary/25" render={<Link href="/shop" />}>
                Shop Now
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 font-semibold border-2" render={<Link href="/restoration" />}>
                Book a Restoration
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Shop categories */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading font-black text-2xl md:text-3xl text-foreground">Shop by Category</h2>
            <Link href="/shop" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Cleaning", emoji: "🧴", href: "/shop?category=cleaning" },
              { label: "Tools", emoji: "🔧", href: "/shop?category=tools" },
              { label: "Storage", emoji: "📦", href: "/shop?category=storage" },
              { label: "Kits", emoji: "🎁", href: "/shop?category=kits" },
            ].map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="bg-white border border-border rounded-xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <span className="text-4xl">{cat.emoji}</span>
                <span className="font-heading font-black text-foreground">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Restoration CTA */}
      <section className="py-16 bg-white border-t border-border">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="bg-primary rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-white">
              <h2 className="font-heading font-black text-3xl md:text-4xl mb-3">Professional Restoration & PSA Prep</h2>
              <p className="text-white/80 text-lg mb-6">Mail us your cards. We clean, restore, and prep them for PSA grading. $120 first card, $100 each after.</p>
              <div className="flex flex-col gap-2 mb-6">
                {["Money-back guarantee", "Photo updates throughout", "5–8 day turnaround"].map((item) => (
                  <span key={item} className="flex items-center gap-2 text-sm font-medium text-white/90">
                    <Check className="h-4 w-4 text-white flex-shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-bold px-8 h-12" render={<Link href="/restoration" />}>
                Book a Restoration
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
