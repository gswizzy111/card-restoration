"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "./progress-indicator";
import { OrderSummary } from "./order-summary";
import { StepServices } from "./step-services";
import { StepCards } from "./step-cards";
import { StepCustomer } from "./step-customer";
import { StepShipping } from "./step-shipping";
import { StepReview } from "./step-review";
import type { Service, CardEntry, CustomerInfo, ShippingRate } from "@/lib/types";

function defaultCard(serviceIds: string[]): CardEntry {
  return {
    id: crypto.randomUUID(),
    card_name: "",
    card_set: "",
    card_year: "",
    card_number: "",
    estimated_value: "",
    notes: "",
    photo_urls: [],
    service_ids: serviceIds,
  };
}

function emptyCustomer(): CustomerInfo {
  return { name: "", email: "", phone: "", street1: "", street2: "", city: "", state: "", zip: "", country: "US" };
}

function InAppBrowserBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok/i.test(ua)) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm">
      <p className="font-bold text-amber-900 mb-1">⚠️ Open in Safari or Chrome to pay</p>
      <p className="text-amber-800">
        Instagram&apos;s browser doesn&apos;t support Stripe payments. Tap the <strong>···</strong> menu at the top right
        of Instagram and choose <strong>&quot;Open in browser&quot;</strong>, then complete your order.
      </p>
    </div>
  );
}

export function OrderBuilder({ services }: { services: Service[] }) {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("service");

  const [step, setStep] = useState(1);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    preselected ? [preselected] : []
  );
  const [cards, setCards] = useState<CardEntry[]>([defaultCard(preselected ? [preselected] : [])]);
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer());
  const [shippingMethod, setShippingMethod] = useState<"buy_label" | "self_ship" | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync new service selections into cards
  function handleServiceChange(ids: string[]) {
    setSelectedServiceIds(ids);
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        service_ids: c.service_ids.filter((s) => ids.includes(s)).concat(
          ids.filter((id) => !c.service_ids.includes(id))
        ),
      }))
    );
  }

  function canAdvance(): boolean {
    if (step === 1) return selectedServiceIds.length > 0;
    if (step === 2) return cards.every((c) => c.card_name.trim().length > 0 && c.service_ids.length > 0);
    if (step === 3) {
      const c = customer;
      return !!(c.name && c.email && c.phone && c.street1 && c.city && c.state && c.zip);
    }
    if (step === 4) {
      if (!shippingMethod) return false;
      if (shippingMethod === "buy_label") return !!selectedRate;
      return true;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: selectedServiceIds.map((id) => ({ id, quantity: 1 })),
          cards: cards.map((c) => ({
            card_name: c.card_name,
            card_set: c.card_set || undefined,
            card_year: c.card_year || undefined,
            card_number: c.card_number || undefined,
            estimated_value_cents: c.estimated_value
              ? Math.round(parseFloat(c.estimated_value) * 100)
              : undefined,
            notes: c.notes || undefined,
            photo_urls: c.photo_urls,
            service_ids: c.service_ids,
          })),
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: {
              street1: customer.street1,
              street2: customer.street2 || undefined,
              city: customer.city,
              state: customer.state,
              zip: customer.zip,
              country: "US",
            },
          },
          shipping_method: shippingMethod,
          shipping_rate: selectedRate
            ? {
                object_id: selectedRate.object_id,
                amount_cents: selectedRate.amount_cents,
                carrier: selectedRate.carrier,
                service_level: selectedRate.service_level,
              }
            : undefined,
          customer_notes: customerNotes || undefined,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        const msg = typeof data.error === "string" ? data.error : "Something went wrong. Please try again.";
        toast.error(msg);
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Checkout fetch error:", err);
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-12">
      <InAppBrowserBanner />
      <div className="mb-10">
        <ProgressIndicator currentStep={step} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main content */}
        <div className="lg:col-span-2">
          {step === 1 && (
            <StepServices
              services={services}
              selectedIds={selectedServiceIds}
              onChange={handleServiceChange}
            />
          )}
          {step === 2 && (
            <StepCards
              cards={cards}
              services={services}
              selectedServiceIds={selectedServiceIds}
              onChange={setCards}
            />
          )}
          {step === 3 && (
            <StepCustomer customer={customer} onChange={setCustomer} />
          )}
          {step === 4 && (
            <StepShipping
              customer={customer}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              onMethodChange={setShippingMethod}
              onRateChange={setSelectedRate}
            />
          )}
          {step === 5 && (
            <StepReview
              services={services}
              selectedServiceIds={selectedServiceIds}
              cards={cards}
              customer={customer}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              customerNotes={customerNotes}
              onNotesChange={setCustomerNotes}
              onEditStep={setStep}
            />
          )}

          {/* Nav buttons */}
          <div className="flex justify-between mt-10 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < 5 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8"
              >
                {submitting ? "Redirecting..." : "Pay Securely with Stripe"}
              </Button>
            )}
          </div>
        </div>

        {/* Order summary — hidden on step 1 */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            {step > 1 && (
              <OrderSummary
                services={services}
                selectedServiceIds={selectedServiceIds}
                cards={cards}
                shippingMethod={shippingMethod}
                selectedRate={selectedRate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
