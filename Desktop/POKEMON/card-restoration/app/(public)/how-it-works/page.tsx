import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    title: "You place an order online",
    description:
      "Browse our services and select what your cards need. Add details and optional photos for each card. Choose to buy a prepaid label from us or ship on your own. Pay securely with credit card, Apple Pay, or Google Pay.",
    note: "Takes about 5 minutes.",
  },
  {
    number: "02",
    title: "You ship the cards to us",
    description:
      "If you bought a label, print it from your confirmation email and drop the package at any USPS, UPS, or FedEx location. If you're shipping on your own, include your order number on a slip inside the package — this is how we match it to your order when it arrives.",
    note: "Tracking included on all shipments.",
  },
  {
    number: "03",
    title: "We receive and assess your cards",
    description:
      "When your package arrives, we open it carefully, photograph the cards, and verify everything matches your order. You'll get an email confirming receipt within one business day.",
    note: "If anything looks different than expected, we'll contact you before starting work.",
  },
  {
    number: "04",
    title: "We perform the restoration",
    description:
      "Each card is treated according to the services you selected, using archival-safe techniques. For Premium Restoration orders, you'll receive progress photos partway through the process.",
    note: "Average turnaround: 5–8 days from receipt.",
  },
  {
    number: "05",
    title: "We ship them back to you",
    description:
      "When your cards are complete, we package them in protective sleeves and a rigid mailer, and ship via insured priority mail. You'll get a tracking number by email.",
    note: "Return shipping included on orders over $100.",
  },
  {
    number: "06",
    title: "You receive restored cards",
    description:
      "Inspect the cards as soon as they arrive. If anything isn't right, contact us within 7 days and we'll make it right.",
    note: "Satisfaction guaranteed.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-secondary/40 border-b border-border py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
            The Process
          </p>
          <h1 className="font-serif font-medium tracking-tight text-4xl md:text-6xl text-foreground mb-4 max-w-2xl">
            Every step, explained.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Here&apos;s exactly what happens from the moment you place an order
            to the day your cards arrive back at your door.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-10 py-16 ${
                  i < steps.length - 1 ? "border-b border-border" : ""
                }`}
              >
                {/* Number side */}
                <div
                  className={`flex flex-col justify-center ${
                    i % 2 === 1 ? "lg:order-2" : ""
                  }`}
                >
                  <span className="font-serif text-7xl md:text-8xl font-medium text-muted/80 leading-none mb-4">
                    {step.number}
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-medium text-foreground">
                    {step.title}
                  </h2>
                </div>

                {/* Content side */}
                <div
                  className={`flex flex-col justify-center gap-4 ${
                    i % 2 === 1 ? "lg:order-1" : ""
                  }`}
                >
                  <p className="text-muted-foreground leading-relaxed text-lg">
                    {step.description}
                  </p>
                  <p className="text-sm text-accent font-medium">
                    {step.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 bg-secondary/60 border border-border rounded-lg p-10 text-center">
            <h3 className="font-serif text-2xl md:text-3xl font-medium text-foreground mb-3">
              Ready to start?
            </h3>
            <p className="text-muted-foreground mb-6">
              The whole process takes about 5 minutes to set up online.
            </p>
            <Button size="lg" className="text-base px-10 h-12" render={<Link href="/order" />}>
              Start an Order
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
