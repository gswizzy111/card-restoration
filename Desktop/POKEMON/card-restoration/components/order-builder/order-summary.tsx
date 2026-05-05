import { formatCurrency } from "@/lib/utils";
import { calcSubtotal, PRICING_TIERS, getPriceCentsForService } from "@/lib/pricing";
import type { Service, CardEntry, ShippingRate } from "@/lib/types";

interface OrderSummaryProps {
  services: Service[];
  selectedServiceIds: string[];
  cards: CardEntry[];
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
}

export function OrderSummary({ services, selectedServiceIds, cards, shippingMethod, selectedRate }: OrderSummaryProps) {
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const subtotal = calcSubtotal(cards, services);
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const total = subtotal + shipping;
  const maxTurnaround = selectedServices.reduce((max, s) => Math.max(max, s.turnaround_days), 0);

  // Count cards per service for pricing display
  const countPerService: Record<string, number> = {};
  for (const card of cards) {
    for (const sid of card.service_ids) {
      countPerService[sid] = (countPerService[sid] ?? 0) + 1;
    }
  }

  return (
    <div className="bg-white border-2 border-border rounded-xl p-6 flex flex-col gap-4">
      <h3 className="font-heading font-black text-lg text-foreground">Order Summary</h3>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Services selected</span>
          <span>{selectedServices.length}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Cards</span>
          <span>{cards.length}</span>
        </div>
      </div>

      {selectedServices.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm border-t border-border pt-3">
          {selectedServices.map((s) => {
            const count = countPerService[s.id] ?? 0;
            const tiers = PRICING_TIERS[s.name];
            const price = count > 0 ? getPriceCentsForService(s.name, count) : null;
            return (
              <div key={s.id} className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  {count > 0 && tiers && (
                    <p className="text-xs text-muted-foreground">{count} card{count !== 1 ? "s" : ""} × {formatCurrency(price!)}</p>
                  )}
                </div>
                <span className="font-medium text-foreground whitespace-nowrap">
                  {count > 0 && price ? formatCurrency(price * count) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm border-t border-border pt-3">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
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

      {maxTurnaround > 0 && (
        <p className="text-xs text-muted-foreground">Est. turnaround: {maxTurnaround} days from receipt</p>
      )}
    </div>
  );
}
