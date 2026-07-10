import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

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

const sections = [
  {
    title: "Before You Order",
    items: [
      {
        q: "What kinds of cards do you restore?",
        a: "We restore trading cards of all eras and types — vintage and modern sports cards, Pokémon, Magic: The Gathering, and other collectible card games. We can work on cards in any condition short of total destruction. If you're unsure whether your card is a good candidate, email us a photo before placing your order.",
      },
      {
        q: "How do I know which service to pick?",
        a: "If your card has surface dirt or fingerprints but is structurally sound, Surface Clean is enough. If corners are soft or edges are whitened, Edge & Corner Restoration is the right call. For creases, choose Crease Reduction. For cards with multiple issues, Full Restoration covers it all. Premium Restoration is reserved for cards with significant value where extra care and detailed documentation are warranted.",
      },
      {
        q: "Will restoration affect my card's grade if I send it to PSA/BGS later?",
        a: "Restoration is detectable by professional graders and will result in an \"Altered\" or \"Authentic\" designation rather than a numeric grade. We're transparent about this — restoration is for collectors who value how their card looks, not for prepping cards for grading.",
      },
      {
        q: "What if my card can't be restored to my expectations?",
        a: "We'll always give you an honest assessment before starting work. If we believe a card won't respond well to treatment, we'll contact you and refund the service portion of your order. You decide whether we proceed.",
      },
    ],
  },
  {
    title: "Shipping & Insurance",
    items: [
      {
        q: "Is my card insured during shipping?",
        a: "Yes. Every label we generate includes carrier insurance. For high-value cards, contact us before ordering and we'll arrange additional coverage if needed.",
      },
      {
        q: "How should I package my cards?",
        a: "Each card should be in a penny sleeve and a toploader at minimum. Place toploaders between two pieces of cardboard taped together (a \"card sandwich\") and put that inside a padded envelope or small box. Always use a tracked, insured shipping method.",
      },
      {
        q: "Can I ship multiple cards in one order?",
        a: "Yes — and you should. There's no per-package fee, only per-card service fees. Ship as many as you'd like together.",
      },
      {
        q: "What if my package gets lost?",
        a: "All shipments are insured. If a package is lost in transit, we'll work with the carrier to file a claim and refund or re-treat your order as appropriate.",
      },
    ],
  },
  {
    title: "Pricing & Payment",
    items: [
      {
        q: "When do I pay?",
        a: "Upfront, when you place the order. We don't begin work until payment clears.",
      },
      {
        q: "Do you offer refunds?",
        a: "If we determine a card can't be restored to a reasonable standard, we refund the service cost (shipping is non-refundable). Once restoration is complete, we don't offer refunds, but if you're not satisfied with the result we'll work with you to make it right.",
      },
      {
        q: "Do you accept high-value orders?",
        a: "Yes. For orders over $1,000, we recommend contacting us first so we can arrange appropriate insurance and discuss any special handling needs.",
      },
    ],
  },
  {
    title: "Process & Timeline",
    items: [
      {
        q: "How long does restoration take?",
        a: "Turnaround varies by service: Surface Clean is typically 7 days from receipt; Full Restoration is 21 days. Premium Restoration takes 28 days due to additional assessment and documentation. Times start when we receive your cards, not when you place the order.",
      },
      {
        q: "Can I get my cards back faster?",
        a: "Rush turnaround may be available for an additional fee. Contact us before ordering if you have a deadline.",
      },
      {
        q: "Will you send me updates?",
        a: "Yes — automated emails at every major stage: order received, cards received, restoration in progress, restoration complete, and shipped back. Premium Restoration includes photo updates partway through.",
      },
    ],
  },
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

      {/* Can / Cannot fix */}
      <section className="py-14 md:py-20 bg-white border-b border-border">
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

      {/* FAQ sections */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-6 md:px-8">
          <div className="flex flex-col gap-16">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="font-serif text-2xl font-medium text-foreground mb-6">
                  {section.title}
                </h2>
                <Accordion>
                  {section.items.map((item) => (
                    <AccordionItem key={item.q} value={item.q}>
                      <AccordionTrigger className="text-base font-medium text-foreground py-4">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground leading-relaxed pb-4">
                          {item.a}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
