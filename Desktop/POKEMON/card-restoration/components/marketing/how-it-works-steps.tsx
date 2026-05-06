import Link from "next/link";
import { Package, Truck, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Package,
    title: "Order online",
    description: "Choose your service, tell us about your cards, and pay securely upfront. Takes about 5 minutes.",
  },
  {
    icon: Truck,
    title: "Ship to us",
    description: "Print a prepaid label or use your own carrier. Tracking included on everything.",
  },
  {
    icon: Sparkles,
    title: "Get them back",
    description: "We restore, photograph, and ship your cards back in 5–8 days. Email updates at every stage.",
  },
];

export function HowItWorksSteps() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">The Process</p>
          <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground">
            Simple. Fast. Careful.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="relative flex flex-col gap-4 p-6 rounded-xl border-2 border-border hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="font-heading font-black text-4xl text-primary/40">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="font-heading font-black text-xl text-foreground">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/how-it-works" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
            See the full process →
          </Link>
        </div>
      </div>
    </section>
  );
}
