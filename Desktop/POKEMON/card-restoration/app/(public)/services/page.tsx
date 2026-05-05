import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/pricing";

const serviceDetails: Record<string, { includes: string[]; notIncluded?: string }> = {
  "PSA Prep": {
    includes: [
      "Distilled water + all-natural card cleaning liquid",
      "Full surface polish",
      "Small dent and crease correction",
      "Clamping to ensure card is perfectly flat",
      "Ready-to-submit PSA condition",
    ],
    notIncluded: "Larger creases that would be flagged by PSA are noted but not over-corrected.",
  },
  "Full Card Restoration": {
    includes: [
      "Everything in PSA Prep",
      "Humidor treatment for deep crease relaxation",
      "Heat press for stubborn bends",
      "Full crease correction — all visible creases addressed",
      "Final inspection for pristine presentation",
    ],
  },
};

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("display_order");

  return (
    <>
      {/* Hero */}
      <section className="bg-primary text-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4">Our Services</p>
          <h1 className="font-heading font-black text-4xl md:text-6xl mb-4 max-w-2xl leading-tight">
            Two services. Done right.
          </h1>
          <p className="text-white/70 text-lg max-w-xl">
            We keep it focused so we can do it perfectly. Pricing gets better the more cards you send.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="flex flex-col gap-16">
            {(services ?? []).map((service) => {
              const tiers = PRICING_TIERS[service.name];
              const details = serviceDetails[service.name];
              return (
                <div key={service.id} id={service.id} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* Description */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    <h2 className="font-heading font-black text-3xl md:text-4xl text-foreground">
                      {service.name}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed text-lg">
                      {service.full_description}
                    </p>
                    {details?.includes && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                          What&apos;s included
                        </p>
                        <ul className="flex flex-col gap-2">
                          {details.includes.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="text-primary font-bold mt-0.5">✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        {details.notIncluded && (
                          <p className="text-xs text-muted-foreground mt-3 italic">{details.notIncluded}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pricing card */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-24 bg-secondary border-2 border-border rounded-xl p-6 flex flex-col gap-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pricing</p>
                      {tiers && (
                        <div className="flex flex-col gap-2">
                          {tiers.map((tier, i) => (
                            <div
                              key={tier.label}
                              className={`flex justify-between items-center rounded-lg px-3 py-2.5 ${
                                i === 0 ? "bg-white border border-border" : ""
                              }`}
                            >
                              <span className="text-sm text-muted-foreground">{tier.label}</span>
                              <span className="font-heading font-black text-lg text-foreground">
                                {formatCurrency(tier.priceCents)}
                                <span className="text-xs font-normal text-muted-foreground">/card</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{service.turnaround_days}-day turnaround from receipt</p>
                      <Button
                        className="w-full font-bold"
                        render={<Link href={`/order?service=${service.id}`} />}
                      >
                        Order {service.name}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-sm text-muted-foreground">
            Not sure which service you need?{" "}
            <Link href="/faq" className="text-primary font-bold hover:underline">
              Check our FAQ
            </Link>{" "}
            or{" "}
            <a href="mailto:gavinfraiman33@gmail.com" className="text-primary font-bold hover:underline">
              email us
            </a>.
          </div>
        </div>
      </section>
    </>
  );
}
