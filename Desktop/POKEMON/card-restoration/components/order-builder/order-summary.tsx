import { formatCurrency } from "@/lib/utils";
import { getPriceCents } from "@/lib/pricing";
import { getTierById, formatCents } from "@/lib/restoration-tiers";
import type { CardEntry, ShippingRate } from "@/lib/types";
import type { RestorationTierId } from "@/lib/restoration-tiers";

interface OrderSummaryProps {
  cards: CardEntry[];
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  discountPercent?: number;
  isInternational?: boolean;
  selectedTier?: RestorationTierId;
}

export function OrderSummary({ cards, shippingMethod, selectedRate, discountPercent = 0, isInternational = false, selectedTier }: OrderSummaryProps) {
  // Use tier-based pricing if selected, otherwise volume-based
  let subtotal: number;
  let priceDescription: string;

  if (selectedTier) {
    const tier = getTierById(selectedTier);
    subtotal = tier.price_cents * cards.length;
    priceDescription = `${formatCents(tier.price_cents)} each`;
  } else {
    subtotal = getPriceCents(cards.length);
    priceDescription = "$75 each · $65 each for 3+ cards · $60 each for 6+ cards";
  }

  const discountCents = discountPercent > 0 ? Math.round(subtotal * discountPercent / 100) : 0;
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const total = subtotal - discountCents + shipping;

  // Get turnaround description
  let turnaroundText = "Est. turnaround: 5–8 days from receipt";
  if (selectedTier) {
    const tier = getTierById(selectedTier);
    turnaroundText = `Est. turnaround: ${tier.turnaround_min_days}–${tier.turnaround_max_days} days from receipt`;
  }

  return (
    <div className="bg-white border-2 border-border rounded-xl p-6 flex flex-col gap-4">
      <h3 className="font-heading font-black text-lg text-foreground">Order Summary</h3>

      <div className="flex flex-col gap-1 text-sm border-b border-border pb-3">
        <div className="flex justify-between text-muted-foreground">
          <span>{selectedTier ? getTierById(selectedTier).name : "Full Restoration & PSA Prep"}</span>
          <span>{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground">{priceDescription}</p>
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
        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border text-base">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{turnaroundText}</p>
    </div>
  );
}
