import { formatCurrency } from "@/lib/utils";
import { getPriceCents } from "@/lib/pricing";
import type { CardEntry, ShippingRate } from "@/lib/types";

interface OrderSummaryProps {
  cards: CardEntry[];
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  discountPercent?: number;
}

export function OrderSummary({ cards, shippingMethod, selectedRate, discountPercent = 0 }: OrderSummaryProps) {
  const subtotal = getPriceCents(cards.length);
  const discountCents = discountPercent > 0 ? Math.round(subtotal * discountPercent / 100) : 0;
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const total = subtotal - discountCents + shipping;

  return (
    <div className="bg-white border-2 border-border rounded-xl p-6 flex flex-col gap-4">
      <h3 className="font-heading font-black text-lg text-foreground">Order Summary</h3>

      <div className="flex flex-col gap-1 text-sm border-b border-border pb-3">
        <div className="flex justify-between text-muted-foreground">
          <span>Full Restoration & PSA Prep</span>
          <span>{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground">$75 each · $65 each for 3+ cards · $60 each for 6+ cards</p>
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
          <span>Shipping</span>
          <span>
            {shippingMethod === "self_ship" ? "Self-ship" : selectedRate ? formatCurrency(selectedRate.amount_cents) : "—"}
          </span>
        </div>
        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border text-base">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Est. turnaround: 5–8 days from receipt</p>
    </div>
  );
}
