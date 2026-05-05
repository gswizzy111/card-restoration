import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

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
