import type { Metadata } from "next";
import { FAQ_SECTIONS } from "./faq-data";
import { FaqSearch } from "./faq-search";

export const metadata: Metadata = {
  title: "FAQ | The Card Doc",
  description: "Answers about restoration and prep: tiers, declared value, slabs, grading, shipping, drop-off and the cards we work on.",
};

// FAQ rich results for search engines
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_SECTIONS.flatMap((s) =>
    s.items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } }))
  ),
};

const canFix = [
  "Surface dirt, dust, and fingerprints",
  "Soft or dinged corners",
  "Light surface scratches and scuffs",
  "Dull or hazy surfaces",
  "Minor stains or residue",
  "Light creases (partial reduction possible)",
  "Slight print lines on the surface",
];

const cannotFix = [
  "Deep or permanent creases and folds",
  "Torn, cut, or ripped cards",
  "Water damage and warping",
  "Delamination or missing layers",
  "Factory print defects (miscuts, misprints)",
  "Trimmed or altered edges",
  "Major structural damage",
  "Heavy ink loss or fading",
];

export default function FAQPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary/40 border-b border-border py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            FAQ
          </p>
          <h1 className="font-serif font-medium tracking-tight text-4xl md:text-6xl text-foreground mb-4">
            Common questions.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Everything you need to know before placing your first order.
          </p>
        </div>
      </section>

      {/* Questions, searchable */}
      <section className="py-14 md:py-20 bg-background">
        <div className="max-w-3xl mx-auto px-6 md:px-8">
          <FaqSearch sections={FAQ_SECTIONS} />
        </div>
      </section>

      {/* Can / Cannot fix */}
      <section className="py-14 md:py-20 bg-white border-t border-border">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <h2 className="font-serif text-2xl font-medium text-foreground mb-2 text-center">What we can (and can&apos;t) fix</h2>
          <p className="text-muted-foreground text-sm text-center mb-10">Restoration has real limits. Here&apos;s an honest breakdown.</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-green-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">✓</div>
                <h3 className="font-medium text-foreground">We CAN help with</h3>
              </div>
              <ul className="flex flex-col gap-2.5">
                {canFix.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-red-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold">✕</div>
                <h3 className="font-medium text-foreground">We CANNOT fix</h3>
              </div>
              <ul className="flex flex-col gap-2.5">
                {cannotFix.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Not sure if your card qualifies? Email a photo to{" "}
            <a href="mailto:thecarddoc1@gmail.com" className="underline">thecarddoc1@gmail.com</a>{" "}
            before ordering.
          </p>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c") }} />
    </>
  );
}
