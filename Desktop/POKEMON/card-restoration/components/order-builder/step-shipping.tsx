"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { CustomerInfo, ShippingRate } from "@/lib/types";

interface StepShippingProps {
  customer: CustomerInfo;
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  onMethodChange: (method: "buy_label" | "self_ship") => void;
  onRateChange: (rate: ShippingRate | null) => void;
}

export function StepShipping({
  customer,
  shippingMethod,
  selectedRate,
  onMethodChange,
  onRateChange,
}: StepShippingProps) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");

  useEffect(() => {
    if (shippingMethod !== "buy_label") return;
    setLoadingRates(true);
    setRatesError("");
    fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_address: {
          name: customer.name,
          street1: customer.street1,
          street2: customer.street2,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
          country: "US",
          phone: customer.phone,
          email: customer.email,
        },
        parcel: { length: 6, width: 4, height: 1, weight: 4 },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) {
          setRates(data.rates);
          if (data.rates.length > 0) onRateChange(data.rates[0]);
        } else {
          setRatesError("Could not load shipping rates. Please try self-ship.");
        }
      })
      .catch(() => setRatesError("Could not load shipping rates."))
      .finally(() => setLoadingRates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethod]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
          How will you send your cards to us?
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {/* Buy label */}
        <button
          type="button"
          onClick={() => onMethodChange("buy_label")}
          className={`w-full text-left rounded-lg border p-5 transition-colors ${
            shippingMethod === "buy_label"
              ? "border-accent bg-accent/5"
              : "border-border bg-card hover:border-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                shippingMethod === "buy_label" ? "border-accent" : "border-muted-foreground"
              }`}
            >
              {shippingMethod === "buy_label" && (
                <div className="w-2 h-2 rounded-full bg-accent" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Buy a prepaid shipping label</p>
                <span className="text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                We generate a label and email it to you. Just print, tape it on, drop it off.
                Includes tracking and insurance.
              </p>

              {/* Rates */}
              {shippingMethod === "buy_label" && (
                <div className="mt-4 flex flex-col gap-2">
                  {loadingRates && (
                    <>
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </>
                  )}
                  {ratesError && (
                    <p className="text-sm text-destructive">{ratesError}</p>
                  )}
                  {!loadingRates && rates.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-1">Price covers shipping to us + return shipping back to you.</p>
                  )}
                  {!loadingRates &&
                    rates.map((rate) => (
                      <button
                        key={rate.object_id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRateChange({ ...rate, amount_cents: rate.amount_cents * 2 });
                        }}
                        className={`w-full text-left rounded-lg border px-4 py-3 flex items-center justify-between transition-colors ${
                          selectedRate?.object_id === rate.object_id
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {rate.carrier} — {rate.service_level}
                          </p>
                          {rate.days && (
                            <p className="text-xs text-muted-foreground">
                              Est. {rate.days} business days each way
                            </p>
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {formatCurrency(rate.amount_cents * 2)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Self ship */}
        <button
          type="button"
          onClick={() => { onMethodChange("self_ship"); onRateChange(null); }}
          className={`w-full text-left rounded-lg border p-5 transition-colors ${
            shippingMethod === "self_ship"
              ? "border-accent bg-accent/5"
              : "border-border bg-card hover:border-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                shippingMethod === "self_ship" ? "border-accent" : "border-muted-foreground"
              }`}
            >
              {shippingMethod === "self_ship" && (
                <div className="w-2 h-2 rounded-full bg-accent" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">I&apos;ll ship them myself</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use your own carrier and packaging. We&apos;ll send you our shipping address after
                checkout. Be sure to use a tracked, insured method.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
