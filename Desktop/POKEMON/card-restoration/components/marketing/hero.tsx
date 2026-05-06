"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Red right-side accent */}
      <div className="absolute top-0 right-0 w-2 h-full bg-primary pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-6 pb-16 md:pt-8 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 items-center min-h-[85vh]">

          {/* Left: text */}
          <div className="lg:-mt-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6 md:mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Trusted Card Restoration
              </span>
            </div>

            <h1 className="font-heading font-black text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.0] tracking-tight mb-5 md:mb-6">
              Your Cards.<br />
              <span className="text-primary">Restored.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 md:mb-10">
              Professional PSA prep and full card restoration for Pokémon, sports cards,
              and collectibles. Mail us your cards — we do the rest.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-8 md:mb-10">
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
          <div className="flex items-center justify-center lg:justify-end lg:-mt-10">
            <div className="relative w-full lg:w-[115%] xl:w-[120%] lg:-mr-8">
              {/* Glow behind the image */}
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
