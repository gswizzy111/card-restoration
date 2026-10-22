import Link from "next/link";
import type { Metadata } from "next";
import { getLiveTiers, tierPrice, tierTurnaround, tierValueRange } from "@/lib/live-tiers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us | The Card Doc",
  description: "Learn about The Card Doc — expert PSA prep and card restoration for collectors.",
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

// Same answers as the FAQ page and How It Works
const faqItems = [
  {
    q: "What types of cards do you work on?",
    a: "We restore all trading cards — Pokémon, sports cards (baseball, basketball, football, hockey), Magic: The Gathering, Yu-Gi-Oh!, and more. Vintage or modern, we handle them all.",
  },
  {
    q: "Will PSA detect the restoration? Will it come back \"altered\"?",
    a: "There is always an inherent risk — low, but not zero. We stay within grading limits, add no material, and only manipulate what's already there.",
  },
  {
    q: "How do I ship my cards safely?",
    a: "Place each card in a penny sleeve, then inside a Card Saver 1 or toploader. Sandwich the holders between two pieces of rigid cardboard. Wrap in bubble wrap and seal inside a padded mailer or small box so nothing shifts.",
  },
  {
    q: "What if you can't fix my card?",
    a: "Then we refund the service cost and send it back — you just cover shipping both ways. We inspect every card on arrival specifically to make that call before work begins.",
  },
  {
    q: "How long does restoration take?",
    a: "It depends on the tier you choose (see Our Tiers above). Estimates start when your status hits Cards Received (or upon arrival for Fast Pass) and do not include shipping transit time.",
  },
  {
    q: "Do you offer refunds?",
    a: "We never guarantee results or grades. Every card is evaluated when it arrives: if we can't improve a restoration card, we refund the service cost and ship it back untouched (you only cover round-trip shipping), and if a card booked for restoration only needs a clean, we downgrade it to Prep so you don't overpay. Have a concern about a finished card? Message @the_card_doc and we'll take another look.",
  },
];

export default async function AboutPage() {
  const tiers = await getLiveTiers();
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
            The Card Doc is a professional card restoration service built for collectors who care about how their cards look. We don&apos;t cut corners.
          </p>
        </div>
      </section>

      {/* Tiers: the same names, prices and turnarounds as the booking page */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 md:px-10">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-3 text-center">Our Tiers</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
            Every tier gets the exact same care—you are only paying for turnaround speed and value coverage.
          </p>
          <div className="border border-border rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  {["Tier", "Price", "Card value", "Turnaround"].map((h) => (
                    <th key={h} scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiers.map((t) => (
                  <tr key={t.id}>
                    <th scope="row" className="px-5 py-4 font-bold text-foreground">{t.name}</th>
                    <td className="px-5 py-4 text-foreground">{tierPrice(t)}</td>
                    <td className="px-5 py-4 text-muted-foreground">{tierValueRange(t)}</td>
                    <td className="px-5 py-4 text-muted-foreground">{tierTurnaround(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground text-center mt-6">
            <Link href="/tier-selection" className="text-[#1a8fe0] font-medium hover:underline">Book a restoration</Link>
            {" "}·{" "}
            <Link href="/prep" className="text-[#1a8fe0] font-medium hover:underline">See Prep pricing</Link>
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

      {/* Terms of Service summary */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-3 text-center">Terms of Service</h2>
          <p className="text-muted-foreground text-center mb-10">The key points — plain English. Read the full version before submitting.</p>
          <div className="flex flex-col gap-4">
            {[
              {
                title: "You assume shipping risk",
                body: "We're not responsible for loss, damage, or theft while cards are in transit to or from us. Use tracked, insured shipping and pack your cards properly.",
              },
              {
                title: "No guaranteed results",
                body: "Results and grades are never guaranteed. Restoration stays within grading limits, but there's always an inherent risk, low but not zero, that a grader detects it or returns a card as altered.",
              },
              {
                title: "Results vary",
                body: "Restoration involves subjective judgment. We'll contact you if we don't think we can improve your card. If damage occurs during the process, our liability is limited to the service fee paid.",
              },
              {
                title: "Payment is upfront",
                body: "Full payment is collected at checkout. Service fees are non-refundable once work has begun, except as our Terms provide (for example, when we can't improve a card).",
              },
              {
                title: "Report problems within 14 days",
                body: "Tell us about any problem with your returned cards in writing within 14 days of delivery, with photos.",
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
              Read the full Terms of Service →
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
