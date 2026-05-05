import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { Service, CardEntry, CustomerInfo, ShippingRate } from "@/lib/types";

interface StepReviewProps {
  services: Service[];
  selectedServiceIds: string[];
  cards: CardEntry[];
  customer: CustomerInfo;
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  customerNotes: string;
  onNotesChange: (v: string) => void;
  onEditStep: (step: number) => void;
}

export function StepReview({
  services,
  cards,
  customer,
  shippingMethod,
  selectedRate,
  customerNotes,
  onNotesChange,
  onEditStep,
}: StepReviewProps) {
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

  let subtotal = 0;
  for (const card of cards) {
    for (const sid of card.service_ids) {
      if (serviceMap[sid]) subtotal += serviceMap[sid].price_cents;
    }
  }
  const shipping = shippingMethod === "buy_label" && selectedRate ? selectedRate.amount_cents : 0;
  const total = subtotal + shipping;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">Review your order.</h2>
      </div>

      {/* Cards & services */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Cards & Services</h3>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        {cards.map((card, i) => (
          <div key={card.id} className="border border-border rounded-lg p-4 flex flex-col gap-2">
            <p className="font-medium text-foreground text-sm">
              Card {i + 1}: {card.card_name}
            </p>
            <div className="flex flex-wrap gap-1">
              {card.service_ids.map((sid) => {
                const svc = serviceMap[sid];
                return svc ? (
                  <span
                    key={sid}
                    className="text-xs bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground"
                  >
                    {svc.name} — {formatCurrency(svc.price_cents)}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Shipping */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Shipping</h3>
          <button
            type="button"
            onClick={() => onEditStep(4)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {shippingMethod === "buy_label"
            ? selectedRate
              ? `Prepaid label — ${selectedRate.carrier} ${selectedRate.service_level} — ${formatCurrency(selectedRate.amount_cents)}`
              : "Prepaid label"
            : "Self-ship — you'll receive our address after checkout"}
        </p>
      </div>

      {/* Customer info */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Your Information</h3>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="text-sm text-muted-foreground flex flex-col gap-0.5">
          <p>{customer.name}</p>
          <p>{customer.email}</p>
          <p>{customer.phone}</p>
          <p>
            {customer.street1}
            {customer.street2 ? `, ${customer.street2}` : ""}
          </p>
          <p>
            {customer.city}, {customer.state} {customer.zip}
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="border border-border rounded-lg p-5 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Shipping</span>
          <span>{shippingMethod === "self_ship" ? "Self-ship" : formatCurrency(shipping)}</span>
        </div>
        <div className="flex justify-between font-medium text-foreground pt-2 border-t border-border">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-notes">Anything else we should know? (optional)</Label>
        <Textarea
          id="customer-notes"
          value={customerNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Special instructions, packaging preferences, etc."
        />
      </div>
    </div>
  );
}
