"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { CustomerInfo, ShippingRate } from "@/lib/types";

import { Need, Req } from "@/components/checkout/required";
interface StepShippingProps {
  customer: CustomerInfo;
  shippingMethod: "buy_label" | "self_ship" | null;
  selectedRate: ShippingRate | null;
  onMethodChange: (method: "buy_label" | "self_ship") => void;
  onRateChange: (rate: ShippingRate | null) => void;
  /** The customer pressed Continue with something missing: outline it in red */
  showMissing?: boolean;
}

export function StepShipping({
  customer,
  shippingMethod,
  selectedRate,
  onMethodChange,
  onRateChange,
  showMissing = false,
}: StepShippingProps) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");
  // Bumped by "Try again" to fetch the rates again
  const [ratesAttempt, setRatesAttempt] = useState(0);

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

  // Domestic: the prepaid label is priced from the trip to us, paid twice (to
  // us and back); shipping your own way pays for the trip back, once, quoted
  // from us to you. The server looks the rate up again at checkout.
  const trips = shippingMethod === "buy_label" ? 2 : 1;
  useEffect(() => {
    if (isInternational || !shippingMethod) return;
    let stale = false;
    // Keep the same service when the rates are fetched again
    const previous = selectedRate;
    onRateChange(null);
    setRates([]);
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
        from_business: shippingMethod === "self_ship",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (stale) return;
        if (data.rates && data.rates.length > 0) {
          const all: ShippingRate[] = data.rates;
          // Only show Priority/Express options for restoration labels
          const expedited = all.filter((r) => /priority|express/i.test(r.service_level));
          const filtered = expedited.length > 0 ? expedited : all;
          setRates(filtered);
          const pick = filtered.find((r) => previous && r.carrier === previous.carrier && r.service_level === previous.service_level) ?? filtered[0];
          onRateChange({ ...pick, amount_cents: pick.amount_cents * trips });
        } else {
          setRatesError("Could not load shipping rates for this address. Check it on the previous step, or");
        }
      })
      .catch(() => { if (!stale) setRatesError("Could not load shipping rates."); })
      .finally(() => { if (!stale) setLoadingRates(false); });
    return () => { stale = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethod, ratesAttempt]);

  /** The rate choices inside the chosen method's card, priced for its trips. */
  function rateOptions(note: string, daysText: (days: number) => string) {
    return (
      <>
        {loadingRates && (
          <>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </>
        )}
        {ratesError && (
          <p className="text-sm text-destructive">
            {ratesError}{" "}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setRatesAttempt((n) => n + 1); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setRatesAttempt((n) => n + 1); } }}
              className="font-semibold underline underline-offset-2 cursor-pointer"
            >
              Try again
            </span>
          </p>
        )}
        {!loadingRates && rates.length > 0 && (
          <p className="text-xs text-muted-foreground mb-1">{note}</p>
        )}
        {!loadingRates && rates.map((rate) => {
          const chosen = selectedRate?.object_id === rate.object_id;
          return (
            <button
              key={rate.object_id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRateChange({ ...rate, amount_cents: rate.amount_cents * trips });
              }}
              className={`w-full text-left rounded-lg border-2 px-4 py-3 flex items-center justify-between transition-all ${
                chosen
                  ? "border-[#1a8fe0] bg-blue-50 shadow-sm"
                  : "border-border hover:border-[#1a8fe0]/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${chosen ? "border-[#1a8fe0] bg-[#1a8fe0]" : "border-muted-foreground"}`}>
                  {chosen && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${chosen ? "text-[#1a8fe0]" : "text-foreground"}`}>
                    {rate.carrier} — {rate.service_level}
                  </p>
                  {rate.days && (
                    <p className="text-xs text-muted-foreground">{daysText(rate.days)}</p>
                  )}
                </div>
              </div>
              <span className={`font-bold ${chosen ? "text-[#1a8fe0]" : "text-foreground"}`}>{formatCurrency(rate.amount_cents * trips)}</span>
            </button>
          );
        })}
      </>
    );
  }

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

          <Need missing={showMissing && !selectedRate} note="Choose a return shipping option.">
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
          </Need>
        </div>
      </div>
    );
  }

  // ── Domestic layout ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
          How will you send your cards to us?<Req />
        </h2>
      </div>

      <Need missing={showMissing && !shippingMethod} note="Choose how you'll send your cards." className="flex flex-col gap-3">
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
                We generate a prepaid label and email it to you. Print, tape it on, and drop it off. Includes tracking. Insured shipping and signature confirmation are optional add-ons at checkout.
              </p>
              {shippingMethod === "buy_label" && (
                <Need missing={showMissing && !selectedRate} note="Choose a shipping option." className="mt-4 flex flex-col gap-2">
                  {rateOptions("Price covers shipping to us + return shipping back to you.", (days) => `Est. ${days} business days each way`)}
                </Need>
              )}
            </div>
          </div>
        </button>

        {/* Self ship */}
        <button
          type="button"
          onClick={() => onMethodChange("self_ship")}
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
            <div className="flex-1">
              <p className="font-medium text-foreground">I&apos;ll ship them myself</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use your own carrier and packaging. We&apos;ll send you our shipping address after checkout. Be sure to use a tracked, insured method.
              </p>
              {shippingMethod === "self_ship" && (
                <Need missing={showMissing && !selectedRate} note="Choose a return shipping option." className="mt-4 flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">Return shipping back to you<Req /></p>
                  {rateOptions("You pay for the trip back now; we ship your restored cards back with a tracked label.", (days) => `Est. ${days} business days`)}
                </Need>
              )}
            </div>
          </div>
        </button>
      </Need>
    </div>
  );
}
