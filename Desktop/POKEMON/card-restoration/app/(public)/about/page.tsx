import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | The Card Doc",
  description: "Learn about The Card Doc — expert PSA prep and card restoration for collectors.",
};

const canFix = [
  "Surface dirt, dust, and fingerprints",
  "Edge whitening and silvering",
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

const faqItems = [
  {
    q: "What types of cards do you work on?",
    a: "We restore all trading cards — Pokémon, sports cards (baseball, basketball, football, hockey), Magic: The Gathering, Yu-Gi-Oh!, and more. Vintage or modern, we handle them all.",
  },
  {
    q: "Will restoration affect PSA/BGS grading?",
    a: "Yes. Professional graders can detect restoration and will designate the card as 'Altered' or 'Authentic' rather than giving a numeric grade. We're fully transparent about this — restoration is for collectors who want their cards to look their best, not for preparing cards for numeric grades.",
  },
  {
    q: "How do I ship my cards safely?",
    a: "Sleeve each card in a penny sleeve, then a toploader. Sandwich the toploaders between two pieces of rigid cardboard taped together, then place inside a padded envelope or small box. Always use a tracked, insured service.",
  },
  {
    q: "What if my card can't be fully restored?",
    a: "We'll contact you before starting work if we believe a card won't respond well to treatment. You'll decide whether to proceed, and we'll refund the service portion if we can't meet a reasonable standard.",
  },
  {
    q: "How long does restoration take?",
    a: "Turnaround varies by tier: Regular is 12–15 business days, Expedited is 7–10 business days, Premium is 5–7 business days, and Ultra Premium is 3–5 business days. All times start from when we physically receive your cards.",
  },
  {
    q: "Do you offer refunds?",
    a: "If we determine a card can't be restored to a reasonable standard, we refund the service cost (shipping is non-refundable). Once restoration is complete, refunds aren't offered — but if you're unsatisfied with the result we'll work with you to make it right.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#1a8fe0] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 md:px-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70 mb-4">About Us</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            We treat every card like it&apos;s worth a fortune.
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            The Card Doc is a professional card restoration and PSA prep service built for collectors who care about how their cards look. We don&apos;t cut corners.
          </p>
        </div>
      </section>


      {/* Can / Cannot fix */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="max-w-4xl mx-auto px-6 md:px-10">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-3 text-center">What we can (and can&apos;t) fix</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Restoration has real limits. Here&apos;s an honest breakdown of what our process can address.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Can fix */}
            <div className="bg-white rounded-2xl border border-green-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg">✓</div>
                <h3 className="font-heading text-lg font-bold text-foreground">We CAN help with</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {canFix.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Cannot fix */}
            <div className="bg-white rounded-2xl border border-red-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-lg">✕</div>
                <h3 className="font-heading text-lg font-bold text-foreground">We CANNOT fix</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {cannotFix.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Not sure if your card qualifies? Email us a photo at{" "}
            <a href="mailto:thecarddoc1@gmail.com" className="underline">thecarddoc1@gmail.com</a>{" "}
            before placing an order.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-3 text-center">Frequently asked questions</h2>
          <p className="text-muted-foreground text-center mb-12">Everything you need to know before placing your first order.</p>
          <div className="flex flex-col gap-0 divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {faqItems.map((item) => (
              <details key={item.q} className="group bg-white">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer font-medium text-foreground text-sm select-none list-none">
                  {item.q}
                  <span className="ml-4 shrink-0 text-muted-foreground group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
                </summary>
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:thecarddoc1@gmail.com" className="text-[#1a8fe0] font-medium hover:underline">Email us</a>{" "}
              or DM us on{" "}
              <a href="https://www.instagram.com/the_card_doc" target="_blank" rel="noopener noreferrer" className="text-[#1a8fe0] font-medium hover:underline">Instagram</a>.
            </p>
          </div>
        </div>
      </section>

      {/* Terms & Conditions summary */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-3 text-center">Terms & Conditions</h2>
          <p className="text-muted-foreground text-center mb-10">The key points — plain English. Read the full version before submitting.</p>
          <div className="flex flex-col gap-4">
            {[
              {
                title: "You assume shipping risk",
                body: "We're not responsible for loss, damage, or theft while cards are in transit to or from us. Use tracked, insured shipping and pack your cards properly.",
              },
              {
                title: "Restoration isn't grading",
                body: "Restored cards will be marked 'Altered' by professional graders (PSA, BGS, etc.) and will not receive a numeric grade. Do not send cards for restoration if you plan to grade them.",
              },
              {
                title: "Results vary",
                body: "Restoration involves subjective judgment. We'll contact you if we don't think we can improve your card. If damage occurs during the process, our liability is limited to the service fee paid.",
              },
              {
                title: "Payment is upfront",
                body: "Full payment is collected at checkout. Service fees are non-refundable once work has begun, except in cases where we cannot restore the card.",
              },
              {
                title: "Inspect within 5 days",
                body: "You must report any issues with returned cards within 5 calendar days of receipt. Claims made after this window are waived.",
              },
              {
                title: "Submit only authentic cards",
                body: "By submitting a card you confirm it's genuine and unaltered. Submitting doctored, trimmed, or counterfeit cards is prohibited. Service fees are non-refundable on such submissions.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="bg-white rounded-xl border border-border p-5">
                <p className="font-semibold text-foreground mb-1">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#1a8fe0] hover:underline"
            >
              Read the full Terms & Conditions →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-[#1a8fe0]">
        <div className="max-w-3xl mx-auto px-6 md:px-10 text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">Ready to restore your cards?</h2>
          <p className="text-white/80 mb-8">Book a restoration or grab a kit and get started today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/restoration"
              className="px-8 py-3 bg-white text-[#1a8fe0] font-bold rounded-lg hover:bg-white/90 transition-colors"
            >
              Book Restoration
            </Link>
            <Link
              href="/shop"
              className="px-8 py-3 border border-white text-white font-bold rounded-lg hover:bg-white/10 transition-colors"
            >
              Browse Kits
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
