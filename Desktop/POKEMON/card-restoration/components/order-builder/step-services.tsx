import { formatCurrency } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/pricing";
import type { Service } from "@/lib/types";

interface StepServicesProps {
  services: Service[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StepServices({ services, selectedIds, onChange }: StepServicesProps) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading font-black text-2xl text-foreground mb-1">
          What does your card need?
        </h2>
        <p className="text-muted-foreground text-sm">
          Select a service. Pricing scales down automatically when you send more cards.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {services.map((service) => {
          const selected = selectedIds.includes(service.id);
          const tiers = PRICING_TIERS[service.name];
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggle(service.id)}
              className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border bg-white hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-md flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      selected ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {selected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className="font-heading font-black text-lg text-foreground">{service.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{service.short_description}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">from</p>
                  <p className="font-heading font-black text-xl text-primary">
                    {tiers ? formatCurrency(tiers[tiers.length - 1].priceCents) : formatCurrency(service.price_cents)}
                    <span className="text-sm font-normal text-muted-foreground">/card</span>
                  </p>
                </div>
              </div>

              {tiers && (
                <div className="grid grid-cols-3 gap-2 ml-8">
                  {tiers.map((tier) => (
                    <div key={tier.label} className={`rounded-lg p-2.5 text-center ${selected ? "bg-primary/10" : "bg-muted"}`}>
                      <p className="font-bold text-sm text-foreground">{formatCurrency(tier.priceCents)}</p>
                      <p className="text-xs text-muted-foreground">{tier.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
