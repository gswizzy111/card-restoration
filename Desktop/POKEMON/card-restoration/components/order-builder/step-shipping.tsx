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

  const isInternational = !!(customer.country && customer.country !== "US");

  // For international: auto-select self_ship and fetch return rates (business → customer)
  useEffect(() => {
    if (!isInternational) return;
    if (shippingMethod !== "self_ship") {
      onMethodChange("self_ship");
      onRateChange(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternational]);

  useEffect(() => {
    if (isInternational && shippingMethod === "self_ship") {
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
            country: customer.country,
            phone: customer.phone,
            email: customer.email,
          },
          parcel: { length: 7, width: 5, height: 1, weight: 16 },
          from_business: true,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.rates && data.rates.length > 0) {
            setRates(data.rates);
            onRateChange(data.rates[0]);
          } else {
            setRatesError("Could not load return shipping rates. Please contact us.");
          }
        })
        .catch(() => setRatesError("Could not load return shipping rates."))
        .finally(() => setLoadingRates(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternational, shippingMethod]);

  // Domestic: fetch inbound rates when buy_label selected
  useEffect(() => {
    if (isInternational || shippingMethod !== "buy_label") return;
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
          country: customer.country || "US",
          phone: customer.phone,
          email: customer.email,
        },
        parcel: { length: 7, width: 5, height: 1, weight: 16 },
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

  // ── International layout ──────────────────────────────────────────────────
  if (isInternational) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
            Shipping for international orders
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            You&apos;ll ship your cards to us, and we&apos;ll ship them back when done.
          </p>
        </div>

        {/* Inbound — customer ships themselves */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-medium text-foreground mb-1">Sending your cards to us</p>
          <p className="text-sm text-muted-foreground">
            Use FedEx, DHL, or your local postal service to ship to our US address. You&apos;ll receive the full address after checkout. Use a tracked, insured method.
          </p>
        </div>

        {/* Return shipping — we ship back, they pay now */}
        <div className="rounded-lg border border-accent bg-accent/5 p-5">
          <p className="font-medium text-foreground mb-1">Return shipping — we ship your cards back</p>
          <p className="text-sm text-muted-foreground mb-4">
            Select a return shipping option below. This is paid now so we can ship your restored cards back to you.
          </p>

          {loadingRates && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          )}
          {ratesError && <p className="text-sm text-destructive">{ratesError}</p>}
          {!loadingRates && rates.map((rate) => (
            <button
              key={rate.object_id}
              type="button"
              onClick={() => onRateChange(rate)}
              className={`w-full text-left rounded-lg border px-4 py-3 flex items-center justify-between transition-colors mb-2 ${
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
                  <p className="text-xs text-muted-foreground">Est. {rate.days} business days</p>
                )}
              </div>
              <span className="font-medium text-foreground">{formatCurrency(rate.amount_cents)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Domestic layout ───────────────────────────────────────────────────────
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
            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              shippingMethod === "buy_label" ? "border-accent" : "border-muted-foreground"
            }`}>
              {shippingMethod === "buy_label" && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">Buy a prepaid shipping label</p>
                <span className="text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                We generate a label and email it to you. Just print, tape it on, drop it off. Includes tracking and insurance.
              </p>
              {shippingMethod === "buy_label" && (
                <div className="mt-4 flex flex-col gap-2">
                  {loadingRates && (
                    <>
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </>
                  )}
                  {ratesError && <p className="text-sm text-destructive">{ratesError}</p>}
                  {!loadingRates && rates.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Price covers shipping to us + return shipping back to you.
                    </p>
                  )}
                  {!loadingRates && rates.map((rate) => (
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
                          <p className="text-xs text-muted-foreground">Est. {rate.days} business days each way</p>
                        )}
                      </div>
                      <span className="font-medium text-foreground">{formatCurrency(rate.amount_cents * 2)}</span>
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
            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              shippingMethod === "self_ship" ? "border-accent" : "border-muted-foreground"
            }`}>
              {shippingMethod === "self_ship" && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
            <div>
              <p className="font-medium text-foreground">I&apos;ll ship them myself</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use your own carrier and packaging. We&apos;ll send you our shipping address after checkout. Be sure to use a tracked, insured method.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
