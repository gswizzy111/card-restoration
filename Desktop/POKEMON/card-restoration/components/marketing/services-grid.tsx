import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const SERVICE_BULLETS = [
  "Cleaned with distilled water & all-natural card solution",
  "Full surface polish to remove fingerprints, residue, and buff out scratches",
  "Minor dents and small creases corrected",
  "Humidor soak to relax deep bends and folds",
  "Heat press to permanently correct all creases",
  "Clamped flat and inspected — ready for PSA submission",
];

export function ServicesGrid() {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">What We Do</p>
          <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground">
            Our Service
          </h2>
        </div>
        <p className="text-muted-foreground mb-12 max-w-xl">
          One comprehensive service. Professional restoration and PSA grading preparation.
        </p>

        <div className="max-w-lg">
          <div className="flex flex-col rounded-xl border-2 border-border bg-white overflow-hidden hover:border-primary/40 transition-colors">
            <div className="p-6 flex flex-col gap-4 flex-1">
              <h3 className="font-heading font-black text-2xl text-foreground">Full Restoration & PSA Prep</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                Complete card restoration and professional PSA grading preparation in one service.
              </p>
              <ul className="flex flex-col gap-2">
                {SERVICE_BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary font-bold flex-shrink-0 mt-0.5">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">1–3 cards</span>
                  <span className="font-bold text-foreground">{formatCurrency(7500)} each</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">4–5 cards</span>
                  <span className="font-bold text-foreground">{formatCurrency(6500)} each</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">6+ cards</span>
                  <span className="font-bold text-foreground">{formatCurrency(6000)} each</span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Button
                className="w-full font-bold"
                render={<Link href="/restoration" />}
              >
                Book Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
