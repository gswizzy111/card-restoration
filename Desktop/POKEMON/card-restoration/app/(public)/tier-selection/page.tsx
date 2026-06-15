"use client";

import Link from "next/link";
import { getAllTiers, formatCents, formatMaxValue } from "@/lib/restoration-tiers";
import { SOLD_OUT_TIERS } from "@/lib/site-config";
import { CheckCircle, Zap, Crown, Star } from "lucide-react";

const iconMap = {
  regular: CheckCircle,
  expedited: Zap,
  premium: Crown,
  ultra_premium: Star,
};

export default function TierSelectionPage() {
  const tiers = getAllTiers();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-4 text-center">
          Choose Your Restoration Level
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          Select the tier that best fits your cards' needs. Each tier includes professional grading notes.
        </p>
      </div>

      {/* Tier Cards Grid */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const IconComponent = iconMap[tier.id as keyof typeof iconMap];
            const isUltraPremium = tier.id === "ultra_premium";
            const isSoldOut = SOLD_OUT_TIERS.includes(tier.id);

            return (
              <div
                key={tier.id}
                className={`relative rounded-lg overflow-hidden transition-all duration-200 ${
                  isSoldOut
                    ? "border border-gray-200 bg-gray-50 opacity-60"
                    : isUltraPremium
                    ? "border-2 border-[#1a8fe0] bg-gradient-to-br from-blue-50 to-blue-100/50 md:col-span-2 lg:col-span-1 hover:shadow-lg"
                    : "border border-blue-200 bg-white hover:shadow-lg"
                }`}
              >
                {/* Sold Out Banner */}
                {isSoldOut && (
                  <div className="absolute top-0 left-0 right-0 bg-gray-500 text-white text-xs font-bold text-center py-1 z-10">
                    SOLD OUT
                  </div>
                )}

                {/* Badge */}
                {tier.badge && !isSoldOut && (
                  <div className="absolute top-0 right-0 bg-[#1a8fe0] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    {tier.badge}
                  </div>
                )}

                {/* Card Content */}
                <div className={`p-6 md:p-8 flex flex-col h-full ${isSoldOut ? "pt-8" : ""}`}>
                  {/* Icon & Title */}
                  <div className="flex items-start gap-3 mb-4">
                    <IconComponent className={`w-6 h-6 flex-shrink-0 mt-1 ${isSoldOut ? "text-gray-400" : "text-[#1a8fe0]"}`} />
                    <div>
                      <h3 className="font-heading text-xl md:text-2xl font-bold text-foreground">
                        {tier.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="mb-6">
                    <div className={`text-3xl md:text-4xl font-bold mb-1 ${isSoldOut ? "text-gray-400" : "text-[#1a8fe0]"}`}>
                      {formatCents(tier.price_cents)}
                    </div>
                    <p className="text-sm text-muted-foreground">per card</p>
                  </div>

                  {/* Select Button */}
                  {isSoldOut ? (
                    <div className="w-full py-3 px-4 rounded-3xl font-semibold text-center bg-gray-200 text-gray-500 cursor-not-allowed mb-6">
                      Sold Out
                    </div>
                  ) : (
                  <Link
                    href={`/restoration?tier=${tier.id}`}
                    className="w-full py-3 px-4 rounded-3xl font-semibold text-center transition-colors duration-150 bg-[#1a8fe0] text-white hover:bg-[#1570c9] mb-6"
                  >
                    Select {tier.name}
                  </Link>
                  )}

                  {/* Features */}
                  <div className="space-y-3 flex-grow">
                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-1">Turnaround</p>
                      <p className="text-muted-foreground">
                        {tier.turnaround_min_days}–{tier.turnaround_max_days} business days
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-1">Card Value</p>
                      <p className="text-muted-foreground">{formatMaxValue(tier.max_card_value_cents)}</p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-1">Includes</p>
                      <ul className="text-muted-foreground space-y-1">
                        {tier.includes_notes && <li className="flex items-center gap-2"><span className="text-[#1a8fe0]">✓</span> Grader notes</li>}
                        {tier.includes_video && <li className="flex items-center gap-2"><span className="text-[#1a8fe0]">✓</span> Video showcase</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-16 bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            All tiers include professional restoration and{" "}
            <span className="font-semibold text-foreground">grader notes</span>. Questions about which tier is right
            for you?{" "}
            <Link href="/how-it-works" className="text-[#1a8fe0] hover:underline font-semibold">
              Learn what we can restore
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
