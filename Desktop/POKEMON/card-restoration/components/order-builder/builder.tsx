"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "./progress-indicator";
import { OrderSummary } from "./order-summary";
import { StepCards } from "./step-cards";
import { StepCustomer } from "./step-customer";
import { StepShipping } from "./step-shipping";
import { StepReview } from "./step-review";
import type { Service, CardEntry, CustomerInfo, ShippingRate, InsuranceSelection } from "@/lib/types";
import type { RestorationTierId } from "@/lib/restoration-tiers";
import { getTierById } from "@/lib/restoration-tiers";

function defaultCard(serviceId: string, tier?: RestorationTierId): CardEntry {
  return {
    id: crypto.randomUUID(),
    card_name: "",
    card_set: "",
    card_year: "",
    card_number: "",
    estimated_value: "",
    notes: "",
    photo_urls: [],
    service_ids: [serviceId],
    tier,
  };
}

function emptyCustomer(): CustomerInfo {
  return { name: "", email: "", phone: "", street1: "", street2: "", city: "", state: "", zip: "", country: "US" };
}

function InAppBrowserBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (/Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok/i.test(navigator.userAgent)) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm">
      <p className="font-bold text-amber-900 mb-1">⚠️ Open in Safari or Chrome to pay</p>
      <p className="text-amber-800">
        Instagram&apos;s browser doesn&apos;t support Stripe payments. Tap the <strong>···</strong> menu at the top right and choose <strong>&quot;Open in browser&quot;</strong>.
      </p>
    </div>
  );
}

// Steps: 1=Cards, 2=Customer, 3=Shipping, 4=Review
export function OrderBuilder({ services, selectedTier }: { services: Service[]; selectedTier?: RestorationTierId }) {
  const service = services[0];
  const serviceId = service?.id ?? "";

  const [step, setStep] = useState(1);
  const [cards, setCards] = useState<CardEntry[]>([defaultCard(serviceId, selectedTier)]);
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer());
  const [shippingMethod, setShippingMethod] = useState<"buy_label" | "self_ship" | null>(null);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [customerNotes, setCustomerNotes] = useState("");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardAmountCents, setGiftCardAmountCents] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceSelection>({ declaredValueCents: 0, type: "none", chargeCents: 0 });

  function canAdvance(): boolean {
    if (step === 1) return cards.every((c) => c.card_name.trim().length > 0);
    if (step === 2) {
      const c = customer;
      const isUS = !c.country || c.country === "US";
      if (isUS) return !!(c.name && c.email && c.phone && c.street1 && c.city && c.state && c.zip);
      return !!(c.name && c.email && c.phone && c.street1 && c.city && c.country);
    }
    if (step === 3) {
      if (!shippingMethod) return false;
      const isInternational = !!(customer.country && customer.country !== "US");
      if (shippingMethod === "buy_label" || isInternational) return !!selectedRate;
      return true;
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Determine if all cards share one tier or have mixed tiers
      const tiers = cards.map((c) => c.tier ?? selectedTier);
      const uniqueTiers = [...new Set(tiers.filter(Boolean))];
      const singleTier = uniqueTiers.length === 1 ? uniqueTiers[0] : undefined;

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(singleTier
            ? { restoration_tier: singleTier }
            : { services: [{ id: serviceId, quantity: cards.length }] }),
          cards: cards.map((c) => ({
            card_name: c.card_name,
            card_set: c.card_set || undefined,
            card_year: c.card_year || undefined,
            card_number: c.card_number || undefined,
            estimated_value_cents: c.estimated_value ? Math.round(parseFloat(c.estimated_value.replace(/[$,]/g, "")) * 100) : undefined,
            notes: c.notes || undefined,
            photo_urls: c.photo_urls,
            service_ids: [serviceId],
            tier: c.tier ?? selectedTier,
          })),
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: {
              street1: customer.street1,
              street2: customer.street2 || undefined,
              city: customer.city,
              state: customer.state || undefined,
              zip: customer.zip || undefined,
              country: customer.country || "US",
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
          affiliate_code: affiliateCode.trim().toUpperCase() || undefined,
          discount_percent: discountPercent > 0 ? discountPercent : undefined,
          gift_card_code: giftCardCode.trim().toUpperCase() || undefined,
          insurance_declared_value_cents: insurance.declaredValueCents > 0 ? insurance.declaredValueCents : undefined,
          insurance_type: insurance.type !== "none" ? insurance.type : undefined,
          slab_crack_count: cards.filter((c) => c.needs_slab_crack).length || undefined,
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
        <div className="lg:col-span-2">
          {step === 1 && (
            <StepCards
              cards={cards}
              services={services}
              selectedServiceIds={[serviceId]}
              onChange={setCards}
              defaultTier={selectedTier}
            />
          )}
          {step === 2 && <StepCustomer customer={customer} onChange={setCustomer} />}
          {step === 3 && (
            <StepShipping
              customer={customer}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              onMethodChange={setShippingMethod}
              onRateChange={setSelectedRate}
            />
          )}
          {step === 4 && (
            <StepReview
              services={services}
              selectedServiceIds={[serviceId]}
              cards={cards}
              customer={customer}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              customerNotes={customerNotes}
              onNotesChange={setCustomerNotes}
              affiliateCode={affiliateCode}
              onAffiliateCodeChange={setAffiliateCode}
              discountPercent={discountPercent}
              onDiscountChange={setDiscountPercent}
              termsAccepted={termsAccepted}
              onTermsChange={setTermsAccepted}
              insurance={insurance}
              onInsuranceChange={setInsurance}
              giftCardCode={giftCardCode}
              onGiftCardCodeChange={setGiftCardCode}
              giftCardAmountCents={giftCardAmountCents}
              onGiftCardAmountChange={setGiftCardAmountCents}
              onEditStep={(s) => {
                // remap review edit targets to new step numbers
                if (s === 2) setStep(1); // cards
                else if (s === 3) setStep(2); // customer
                else if (s === 4) setStep(3); // shipping
              }}
              selectedTier={selectedTier}
            />
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !termsAccepted} className="px-8">
                {submitting ? "Redirecting..." : "Pay Securely with Stripe"}
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <OrderSummary
              cards={cards}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              discountPercent={discountPercent}
              isInternational={!!(customer.country && customer.country !== "US")}
              selectedTier={selectedTier}
              insurance={insurance}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
