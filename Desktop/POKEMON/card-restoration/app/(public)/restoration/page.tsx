import { Suspense, ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderBuilder } from "@/components/order-builder/builder";
import { isSoldOut, TIER_SELECTION_ENABLED } from "@/lib/site-config";
import type { RestorationTierId } from "@/lib/restoration-tiers";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RestorationPage({ searchParams }: PageProps) {
  // Get tier from query params
  const params = await searchParams;
  const tierParam = params.tier as string | undefined;

  // If tier selection is enabled and no tier selected, redirect to tier selection page
  if (TIER_SELECTION_ENABLED && !tierParam) {
    redirect("/tier-selection");
  }

  if (isSoldOut()) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Restoration Services</p>
        <h1 className="font-heading text-3xl md:text-4xl text-foreground mb-4">Currently Unavailable</h1>
        <p className="text-muted-foreground">We&apos;re at capacity right now. Check back soon — we&apos;ll be accepting new restoration orders again shortly.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, short_description, full_description, price_cents, turnaround_days, display_order, active")
    .eq("active", true)
    .order("display_order");

  return (
    <Suspense>
      <OrderBuilder services={services ?? []} selectedTier={tierParam as RestorationTierId | undefined} />
    </Suspense>
  );
}
