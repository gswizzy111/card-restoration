"use client";

import { useState } from "react";
import { getAllTiers, getTierById, formatCents } from "@/lib/restoration-tiers";
import { formatCurrency } from "@/lib/utils";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TIER_ORDER: RestorationTierId[] = ["regular", "expedited", "premium", "ultra_premium"];
const TAX_RATE = 0.06625;

interface Props {
  orderNumber: string;
  customerEmail: string;
  currentTier: RestorationTierId | null;
  currentSubtotalCents: number;
  cardCount: number;
}

export function UpgradeSection({ orderNumber, customerEmail, currentTier, currentSubtotalCents, cardCount }: Props) {
  const [loading, setLoading] = useState<RestorationTierId | null>(null);
  const [error, setError] = useState("");

  const currentIndex = TIER_ORDER.indexOf(currentTier ?? "regular");
  const upgradeTiers = getAllTiers().filter((t) => TIER_ORDER.indexOf(t.id) > currentIndex);

  if (upgradeTiers.length === 0) return null;

  async function handleUpgrade(tierId: RestorationTierId) {
    setLoading(tierId);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderNumber}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customerEmail, new_tier: tierId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(null);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 p-6 mb-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[#1a8fe0] mb-1">Want Faster Service?</p>
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Upgrade Your Restoration</h2>
      <p className="text-sm text-muted-foreground mb-5">
        You can upgrade to a higher service level until your cards arrive. You only pay the difference.
      </p>

      <div className="flex flex-col gap-3">
        {upgradeTiers.map((tier) => {
          const newSubtotal = tier.price_cents * cardCount;
          const diff = newSubtotal - currentSubtotalCents;
          const tax = Math.round(diff * TAX_RATE);
          const total = diff + tax;

          return (
            <div key={tier.id} className="flex items-center justify-between gap-4 bg-white rounded-lg border border-blue-100 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">{tier.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tier.turnaround_min_days}–{tier.turnaround_max_days} business days · {formatCents(tier.price_cents)}/card
                </p>
                <p className="text-sm font-semibold text-[#1a8fe0] mt-0.5">
                  +{formatCurrency(total)} upgrade fee <span className="text-xs font-normal text-muted-foreground">(incl. tax)</span>
                </p>
              </div>
              <button
                onClick={() => handleUpgrade(tier.id)}
                disabled={loading !== null}
                className="shrink-0 px-4 py-2 bg-[#1a8fe0] text-white text-sm font-bold rounded-lg hover:bg-[#1570c9] transition-colors disabled:opacity-50"
              >
                {loading === tier.id ? "Redirecting..." : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
    </div>
  );
}
