"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Red right-side accent — desktop only */}
      <div className="absolute top-0 right-0 w-2 h-full bg-primary pointer-events-none hidden lg:block" />

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden px-5 pt-8 pb-12">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Trusted Card Restoration
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading font-black text-4xl text-foreground leading-[1.05] tracking-tight mb-6">
          Your Cards.<br />
          <span className="text-primary">Restored.</span>
        </h1>

        {/* Description */}
        <p className="text-base text-muted-foreground leading-relaxed mb-7">
          Professional PSA prep and full card restoration for Pokémon, sports cards,
          and collectibles. Mail us your cards — we do the rest.
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <Button
            size="lg"
            className="text-base h-12 font-bold shadow-lg shadow-primary/25 w-full"
            render={<Link href="/order" />}
          >
            Start an Order
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base h-12 font-semibold border-2 w-full"
            render={<Link href="#how-it-works" />}
          >
            See How It Works
          </Button>
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-2">
          {["Money-back guarantee", "Photo updates", "5–8 day turnaround"].map((item) => (
            <span key={item} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:block max-w-7xl mx-auto px-8 pt-8 pb-20">
        <div className="grid grid-cols-2 gap-4 items-center min-h-[85vh]">

          {/* Left: text */}
          <div className="-mt-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Trusted Card Restoration
              </span>
            </div>

            <h1 className="font-heading font-black text-6xl text-foreground leading-[1.0] tracking-tight mb-6">
              Your Cards.<br />
              <span className="text-primary">Restored.</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-10">
              Professional PSA prep and full card restoration for Pokémon, sports cards,
              and collectibles. Mail us your cards — we do the rest.
            </p>

            <div className="flex flex-row gap-4 mb-10">
              <Button
                size="lg"
                className="text-base px-8 h-12 font-bold shadow-lg shadow-primary/25"
                render={<Link href="/order" />}
              >
                Start an Order
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 font-semibold border-2"
                render={<Link href="#how-it-works" />}
              >
                See How It Works
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {["Money-back guarantee", "Photo updates", "5–8 day turnaround"].map((item) => (
                <span key={item} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: before/after image */}
          <div className="flex items-center justify-end -mt-10">
            <div className="relative w-[115%] xl:w-[120%] -mr-8">
              <div className="absolute inset-8 bg-primary/15 rounded-3xl blur-3xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/before-after-hero.png"
                alt="Before and after card restoration — Charmander"
                className="relative w-full h-auto drop-shadow-2xl"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
