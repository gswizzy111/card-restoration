import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/pricing";

interface Service {
  id: string;
  name: string;
  short_description: string;
  price_cents: number;
  turnaround_days: number;
}

const serviceDetails: Record<string, { bullets: string[] }> = {
  "PSA Prep": {
    bullets: [
      "Cleaned with distilled water & all-natural card solution",
      "Full surface polish to remove fingerprints, residue, and buff out scratches",
      "Minor dents and small creases corrected",
      "Clamped flat and inspected — ready for PSA submission",
    ],
  },
  "Full Card Restoration": {
    bullets: [
      "Everything in PSA Prep, plus full crease treatment",
      "Humidor soak to relax deep bends and folds",
      "Heat press to permanently correct all creases",
      "Final inspection — cards returned looking pristine",
    ],
  },
};

export function ServicesGrid({ services }: { services: Service[] }) {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">What We Do</p>
          <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground">
            Our Services
          </h2>
        </div>
        <p className="text-muted-foreground mb-12 max-w-xl">
          Two focused services done right. Pricing gets better the more cards you send.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service) => {
            const tiers = PRICING_TIERS[service.name];
            const lowestPrice = tiers ? tiers[tiers.length - 1].priceCents : service.price_cents;
            const details = serviceDetails[service.name];
            return (
              <div key={service.id} className="flex flex-col rounded-xl border-2 border-border bg-white overflow-hidden hover:border-primary/40 transition-colors">
                <div className="p-6 flex flex-col gap-4 flex-1">
                  <h3 className="font-heading font-black text-2xl text-foreground">{service.name}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {service.short_description}
                  </p>

                  {details && (
                    <ul className="flex flex-col gap-2">
                      {details.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-primary font-bold flex-shrink-0 mt-0.5">✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {tiers && (
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                      {tiers.map((tier) => (
                        <div key={tier.label} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{tier.label}</span>
                          <span className="font-bold text-foreground">
                            {formatCurrency(tier.priceCents)}
                            <span className="font-normal text-muted-foreground">/card</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">From </span>
                    <span className="font-heading font-black text-2xl text-primary">
                      {formatCurrency(lowestPrice)}
                    </span>
                    <span className="text-xs text-muted-foreground">/card</span>
                  </div>
                  <Button
                    variant="outline"
                    className="border-2 font-bold"
                    render={<Link href={`/order?service=${service.id}`} />}
                  >
                    Order Now
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
