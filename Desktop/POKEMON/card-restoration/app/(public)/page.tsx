import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/marketing/hero";
import { TrustBar } from "@/components/marketing/trust-bar";
import { HowItWorksSteps } from "@/components/marketing/how-it-works-steps";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, short_description, price_cents, turnaround_days")
    .eq("active", true)
    .order("display_order");

  return (
    <>
      <Hero />
      <TrustBar />
      <HowItWorksSteps />
      <ServicesGrid services={services ?? []} />

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-background">
        <div className="max-w-2xl mx-auto px-6 md:px-8 text-center">
          <h2 className="font-serif font-medium tracking-tight text-3xl md:text-5xl text-foreground mb-4">
            Ready to restore your cards?
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Start your order in under five minutes. We&apos;ll guide you
            through every step.
          </p>
          <Button size="lg" className="text-base px-10 h-12" render={<Link href="/order" />}>
            Start an Order
          </Button>
        </div>
      </section>
    </>
  );
}
