import { formatCurrency } from "@/lib/utils";
import { getTierById, getCardPriceCents, formatCents, RESTORATION_TIERS } from "@/lib/restoration-tiers";
import type { CardEntry, ShippingRate, InsuranceSelection } from "@/lib/types";
import { INSURANCE_ENABLED } from "@/lib/site-config";
import { computeOrderTotals } from "@/lib/order-totals";
import type { RestorationTierId } from "@/lib/restoration-tiers";

interface OrderSummaryProps {
  cards: CardEntry[];
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  discountPercent?: number;
  isInternational?: boolean;
  selectedTier?: RestorationTierId;
  insurance?: InsuranceSelection;
  addSignatureConfirmation?: boolean;
  instagramFeature?: boolean;
  giftCardAmountCents?: number;
}

export function OrderSummary({ cards, shippingMethod, selectedRate, discountPercent = 0, isInternational = false, selectedTier, insurance, addSignatureConfirmation = false, instagramFeature = false, giftCardAmountCents = 0 }: OrderSummaryProps) {
  // Build per-tier breakdown
  const tierCounts: Partial<Record<RestorationTierId, number>> = {};
  // What each tier's cards cost (Diamond is a percentage of each card's value)
  const tierCents: Partial<Record<RestorationTierId, number>> = {};
  for (const card of cards) {
    const tierId = card.tier ?? selectedTier;
    if (!tierId) continue;
    tierCounts[tierId] = (tierCounts[tierId] ?? 0) + 1;
    const value = Math.round((parseFloat((card.estimated_value ?? "").replace(/[$,]/g, "")) || 0) * 100);
    tierCents[tierId] = (tierCents[tierId] ?? 0) + getCardPriceCents(getTierById(tierId), value);
  }

  const tierEntries = Object.entries(tierCounts) as [RestorationTierId, number][];
  const isMixed = tierEntries.length > 1;

  const {
    subtotal, discountCents, taxCents, signatureCents, insuranceCents,
    slabCrackCount, slabCrackCents, pregradeCount, pregradeCents, instagramCents, giftCardCents, total,
  } = computeOrderTotals({
    cards,
    selectedTier,
    shippingMethod,
    selectedRate,
    discountPercent,
    insuranceCents: INSURANCE_ENABLED ? (insurance?.chargeCents ?? 0) : 0,
    addSignatureConfirmation: addSignatureConfirmation && !isInternational,
    instagramFeature,
    giftCardAmountCents,
  });

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
                <span>{formatCents(tierCents[tierId] ?? tier.price_cents * count)}</span>
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
              <p className="text-xs text-muted-foreground">
                {getTierById(tierEntries[0][0]).pricing_type === "percentage"
                  ? `${((getTierById(tierEntries[0][0]).pricing_rate ?? 0) * 100).toFixed(0)}% of each card's value: ${formatCents(tierCents[tierEntries[0][0]] ?? 0)}`
                  : `${formatCents(getTierById(tierEntries[0][0]).price_cents)} each`}
              </p>
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
          <span>Sales Tax (6.625%)</span>
          <span>{formatCurrency(taxCents)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{isInternational ? "Return shipping" : "Shipping"}</span>
          <span>
            {isInternational
              ? (selectedRate ? formatCurrency(selectedRate.amount_cents) : "—")
              : shippingMethod === "self_ship" ? "Self-ship" : selectedRate ? formatCurrency(selectedRate.amount_cents) : "—"}
          </span>
        </div>
        {signatureCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Signature Confirmation</span>
            <span>{formatCurrency(signatureCents)}</span>
          </div>
        )}
        {insuranceCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Insurance</span>
            <span>{formatCurrency(insuranceCents)}</span>
          </div>
        )}
        {slabCrackCents > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>Slab Cracking × {slabCrackCount}</span>
            <span>{formatCurrency(slabCrackCents)}</span>
          </div>
        )}
        {pregradeCents > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Pregrade × {pregradeCount}</span>
            <span>{formatCurrency(pregradeCents)}</span>
          </div>
        )}
        {instagramCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Instagram Feature</span>
            <span>{formatCurrency(instagramCents)}</span>
          </div>
        )}
        {giftCardCents > 0 && (
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Gift Card</span>
            <span>−{formatCurrency(giftCardCents)}</span>
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
