import { formatCurrency } from "@/lib/utils";
import { getTierById, formatCents, RESTORATION_TIERS } from "@/lib/restoration-tiers";
import type { CardEntry, ShippingRate, InsuranceSelection } from "@/lib/types";
import { INSURANCE_ENABLED } from "@/lib/site-config";
import type { RestorationTierId } from "@/lib/restoration-tiers";

interface OrderSummaryProps {
  cards: CardEntry[];
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  discountPercent?: number;
  isInternational?: boolean;
  selectedTier?: RestorationTierId;
  insurance?: InsuranceSelection;
}

export function OrderSummary({ cards, shippingMethod, selectedRate, discountPercent = 0, isInternational = false, selectedTier, insurance }: OrderSummaryProps) {
  // Build per-tier breakdown
  const tierCounts: Partial<Record<RestorationTierId, number>> = {};
  let subtotal = 0;

  for (const card of cards) {
    const tierId = card.tier ?? selectedTier;
    if (tierId) {
      tierCounts[tierId] = (tierCounts[tierId] ?? 0) + 1;
      subtotal += getTierById(tierId).price_cents;
    }
  }

  const tierEntries = Object.entries(tierCounts) as [RestorationTierId, number][];
  const isMixed = tierEntries.length > 1;

  const discountCents = discountPercent > 0 ? Math.round(subtotal * discountPercent / 100) : 0;
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const insuranceCents = INSURANCE_ENABLED ? (insurance?.chargeCents ?? 0) : 0;
  const total = subtotal - discountCents + shipping + insuranceCents;

  const turnaroundText = isMixed
    ? "Turnaround varies by tier"
    : tierEntries[0]
    ? `Est. turnaround: ${getTierById(tierEntries[0][0]).turnaround_min_days}–${getTierById(tierEntries[0][0]).turnaround_max_days} days from receipt`
    : "Est. turnaround: 15–20 days from receipt";

  return (
    <div className="bg-white border-2 border-border rounded-xl p-6 flex flex-col gap-4">
      <h3 className="font-heading font-black text-lg text-foreground">Order Summary</h3>

      <div className="flex flex-col gap-1 text-sm border-b border-border pb-3">
        {isMixed ? (
          tierEntries.map(([tierId, count]) => {
            const tier = getTierById(tierId);
            return (
              <div key={tierId} className="flex justify-between text-muted-foreground">
                <span>{tier.name} × {count}</span>
                <span>{formatCents(tier.price_cents * count)}</span>
              </div>
            );
          })
        ) : (
          <>
            <div className="flex justify-between text-muted-foreground">
              <span>{tierEntries[0] ? getTierById(tierEntries[0][0]).name : "Full Restoration & PSA Prep"}</span>
              <span>{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
            </div>
            {tierEntries[0] && (
              <p className="text-xs text-muted-foreground">{formatCents(getTierById(tierEntries[0][0]).price_cents)} each</p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Discount ({discountPercent}% off)</span>
            <span>−{formatCurrency(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>{isInternational ? "Return shipping" : "Shipping"}</span>
          <span>
            {isInternational
              ? (selectedRate ? formatCurrency(selectedRate.amount_cents) : "—")
              : shippingMethod === "self_ship" ? "Self-ship" : selectedRate ? formatCurrency(selectedRate.amount_cents) : "—"}
          </span>
        </div>
        {insuranceCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Insurance</span>
            <span>{formatCurrency(insuranceCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border text-base">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{turnaroundText}</p>
    </div>
  );
}
