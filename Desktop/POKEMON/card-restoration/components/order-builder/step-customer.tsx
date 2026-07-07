"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { US_STATES, INTERNATIONAL_COUNTRIES } from "@/lib/constants";
import type { CustomerInfo } from "@/lib/types";
import type { ChangeEvent } from "react";

const INPUT_CN = "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";


interface StepCustomerProps {
  customer: CustomerInfo;
  onChange: (customer: CustomerInfo) => void;
}

export function StepCustomer({ customer, onChange }: StepCustomerProps) {
  const isUS = customer.country === "US";

  function update(patch: Partial<CustomerInfo>) {
    onChange({ ...customer, ...patch });
  }

  function handleCountryChange(newCountry: string) {
    update({ country: newCountry, state: "", zip: "" });
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
          <Label htmlFor="country">Country *</Label>
          <select
            id="country"
            value={customer.country || "US"}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleCountryChange(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {INTERNATIONAL_COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="street1">Street Address *</Label>
          <AddressAutocomplete
            id="street1"
            value={customer.street1}
            onChange={(v) => update({ street1: v })}
            onPlaceSelect={(f) => update({ street1: f.street1, city: f.city, state: f.state, zip: f.zip })}
            className={INPUT_CN}
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

        {isUS ? (
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
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="state">Province / Region</Label>
            <Input
              id="state"
              value={customer.state}
              onChange={(e) => update({ state: e.target.value })}
              autoComplete="address-level1"
              placeholder="Optional"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zip">{isUS ? "ZIP Code *" : "Postal Code"}</Label>
          <Input
            id="zip"
            value={customer.zip}
            onChange={(e) => update({ zip: e.target.value })}
            autoComplete="postal-code"
            maxLength={10}
            placeholder={isUS ? "" : "Optional"}
          />
        </div>
      </div>
    </div>
  );
}
