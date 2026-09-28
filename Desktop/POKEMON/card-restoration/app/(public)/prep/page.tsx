import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { PixelViewContent } from "@/components/pixel-view-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prep | The Card Doc",
  description: "Professional card submission prep. $25/card for cards under $1,500. 2% of declared value for high-value cards.",
};

async function getPrepPrices() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_config")
      .select("key, value")
      .in("key", ["prep_standard_price_cents", "prep_pre_grade_price_cents", "prep_slab_crack_price_cents", "prep_open"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return {
      standardPriceCents: parseInt(map.prep_standard_price_cents ?? "2500", 10),
      preGradePriceCents: parseInt(map.prep_pre_grade_price_cents ?? "500", 10),
      slabCrackPriceCents: parseInt(map.prep_slab_crack_price_cents ?? "700", 10),
      isOpen: (map.prep_open ?? "true") !== "false",
    };
  } catch {
    return { standardPriceCents: 2500, preGradePriceCents: 500, slabCrackPriceCents: 700, isOpen: true };
  }
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PrepPage() {
  const prices = await getPrepPrices();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <PixelViewContent contentName="PSA Prep" contentCategory="Prep" />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-14 md:py-20">

        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Prep Service</p>
          <h1 className="font-heading text-4xl md:text-5xl font-black text-foreground mb-4">
            Get Your Cards Grade-Ready
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We surface-clean and prep your cards so they&apos;re submission-ready. Prep is grader-legal and won&apos;t affect your numeric grade.
          </p>
        </div>

        {!prices.isOpen && (
          <div className="mb-8 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 text-center text-sm font-semibold text-amber-800">
            ⏸ Prep is temporarily paused — check back soon.
          </div>
        )}

        {/* Pricing */}
        <div className="bg-white border border-border rounded-xl overflow-hidden mb-8">
          <div className="bg-primary px-7 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-2xl font-black text-white">Prep Pricing</h2>
                <p className="text-primary-foreground/70 text-sm mt-0.5">Per card — price based on declared value</p>
              </div>
              <span className="text-4xl">🔬</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-7 py-5">
              <div>
                <p className="font-bold text-foreground">Cards under $1,500</p>
                <p className="text-sm text-muted-foreground mt-0.5">Surface clean, penny sleeve + semi-rigid holder</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-foreground">{fmt(prices.standardPriceCents)}</p>
                <p className="text-xs text-muted-foreground">per card</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-7 py-5">
              <div>
                <p className="font-bold text-foreground">Cards $1,500 and over</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  e.g. $2,000 card = $40.00 &nbsp;·&nbsp; $5,000 card = $100.00
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-foreground">2%</p>
                <p className="text-xs text-muted-foreground">of declared value</p>
              </div>
            </div>
          </div>
          <div className="px-7 py-5 bg-slate-50 border-t border-border">
            {prices.isOpen ? (
              <Link
                href="/prep/order"
                className="w-full py-3 px-4 rounded-full font-bold text-center text-sm block bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Order Prep →
              </Link>
            ) : (
              <div className="w-full py-3 px-4 rounded-full font-bold text-center text-sm bg-gray-200 text-gray-500 cursor-not-allowed">
                Currently Paused
              </div>
            )}
          </div>
        </div>

        {/* Not included */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-5 mb-8">
          <p className="text-xs font-bold text-red-800 uppercase tracking-wide mb-3">Prep does not include:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {["Crease work", "Edge & corner work", "Dent removal", "Any restorative work"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-red-700">
                <span className="font-black text-red-500">✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-3">
            Need restoration?{" "}
            <Link href="/tier-selection" className="font-semibold underline hover:text-red-800">
              See our Restoration tiers →
            </Link>
          </p>
        </div>

        {/* Add-ons */}
        <div className="bg-white border border-border rounded-xl p-6 mb-8">
          <h2 className="font-heading font-black text-base text-foreground mb-4">Available Add-Ons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-border">
              <span className="text-2xl">📊</span>
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="font-heading font-black text-sm text-foreground">Pre-Grade Assessment</h3>
                  <span className="text-xs font-bold text-primary">+{fmt(prices.preGradePriceCents)}/card</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  We assess each card and give you an estimated grade before you submit — so you know what to expect.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-border">
              <span className="text-2xl">🪨</span>
              <div>
                <div className="flex items-baseline gap-2">
                  <h3 className="font-heading font-black text-sm text-foreground">Slab Crack</h3>
                  <span className="text-xs font-bold text-primary">+{fmt(prices.slabCrackPriceCents)}/card</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Already graded? We carefully crack the slab and include the raw card in your prep order.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Add-ons are selected during the order process.</p>
        </div>

        {/* How it works */}
        <div className="bg-white border border-border rounded-xl p-7 mb-8">
          <h2 className="font-heading font-black text-xl text-foreground mb-5">How Prep Works</h2>
          <ol className="flex flex-col gap-4">
            {[
              { n: "1", title: "Place your order", body: "Add your cards, choose your add-ons, and choose how to ship them to us." },
              { n: "2", title: "Ship your cards", body: "Use our prepaid label or ship yourself. We recommend USPS Priority Mail with tracking." },
              { n: "3", title: "We prep your cards", body: "Our team surface-cleans, inspects, and submission-readies every card — penny sleeve + semi-rigid." },
              { n: "4", title: "Cards returned", body: "We return your prepped cards ready for submission. Typical turnaround is 10–15 business days." },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-white font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Questions?{" "}
          <a href="https://www.instagram.com/the_card_doc" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">
            DM us @the_card_doc
          </a>
        </div>
      </div>
    </div>
  );
}
