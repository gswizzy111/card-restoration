import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/constants";
import type { CustomerInfo } from "@/lib/types";

interface StepCustomerProps {
  customer: CustomerInfo;
  onChange: (customer: CustomerInfo) => void;
}

export function StepCustomer({ customer, onChange }: StepCustomerProps) {
  function update(patch: Partial<CustomerInfo>) {
    onChange({ ...customer, ...patch });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
          Where should we ship them back?
        </h2>
        <p className="text-muted-foreground">We&apos;ll also use this to confirm your order.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="full-name">Full Name *</Label>
          <Input
            id="full-name"
            value={customer.name}
            onChange={(e) => update({ name: e.target.value })}
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={customer.email}
            onChange={(e) => update({ email: e.target.value })}
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">
            Phone * <span className="text-xs text-muted-foreground font-normal">(required by carriers)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={customer.phone}
            onChange={(e) => update({ phone: e.target.value })}
            autoComplete="tel"
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="street1">Street Address *</Label>
          <Input
            id="street1"
            value={customer.street1}
            onChange={(e) => update({ street1: e.target.value })}
            autoComplete="address-line1"
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="street2">Apartment, suite, etc.</Label>
          <Input
            id="street2"
            value={customer.street2}
            onChange={(e) => update({ street2: e.target.value })}
            autoComplete="address-line2"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={customer.city}
            onChange={(e) => update({ city: e.target.value })}
            autoComplete="address-level2"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="state">State *</Label>
          <Select value={customer.state || undefined} onValueChange={(v: string | null) => { if (v) update({ state: v }); }}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zip">ZIP Code *</Label>
          <Input
            id="zip"
            value={customer.zip}
            onChange={(e) => update({ zip: e.target.value })}
            autoComplete="postal-code"
            maxLength={10}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value="United States" disabled className="opacity-70" />
        </div>
      </div>
    </div>
  );
}
