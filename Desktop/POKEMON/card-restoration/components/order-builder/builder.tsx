"use client";

import { useState, useEffect, useRef } from "react";
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
import { fbq } from "@/lib/pixel";

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
    <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-6 text-sm shadow-md">
      <p className="font-black text-red-900 text-base mb-2">⚠️ You must open this in Safari or Chrome</p>
      <p className="text-red-800 mb-3 leading-relaxed">
        Instagram&apos;s built-in browser <strong>blocks photo uploads and payments</strong>. You won&apos;t be able to complete your order here.
      </p>
      <p className="text-red-900 font-bold">
        Tap the <strong>···</strong> menu (top right) → <strong>&quot;Open in browser&quot;</strong>
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
  const [loyaltyDiscountPercent, setLoyaltyDiscountPercent] = useState(0);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardAmountCents, setGiftCardAmountCents] = useState(0);
  const [instagramFeature, setInstagramFeature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceSelection>({ declaredValueCents: 0, type: "none", chargeCents: 0 });
  const [addSignatureConfirmation, setAddSignatureConfirmation] = useState(false);
  const [checkoutError, setCheckoutError] = useState<{ message: string; ref: string } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const DIAMOND_MIN_CENTS = 500_000; // $5,000

  function totalEstimatedValueCents(): number {
    return cards.reduce((sum, c) => {
      const v = c.estimated_value ? Math.round(parseFloat(c.estimated_value.replace(/[$,]/g, "")) * 100) : 0;
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }

  const isDiamondOrder = selectedTier === "elite" || cards.some((c) => c.tier === "elite");
  const diamondValueOk = !isDiamondOrder || totalEstimatedValueCents() >= DIAMOND_MIN_CENTS;

  function canAdvance(): boolean {
    if (step === 1) {
      const basicOk = cards.every((c) => c.card_name.trim().length > 0 && c.photo_urls.length > 0);
      return basicOk && diamondValueOk;
    }
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
    fbq("track", "InitiateCheckout", { num_items: cards.length, currency: "USD" });
    setSubmitting(true);
    setCheckoutError(null);
    try {
      // Upload signature before going to Stripe
      let signaturePath: string | undefined;
      if (signatureDataUrl) {
        const sigRes = await fetch("/api/orders/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: signatureDataUrl }),
        });
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          signaturePath = sigData.path;
        }
        // If upload fails, we still proceed — the act of signing is enforced on the client
      }

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
          instagram_feature: instagramFeature || undefined,
          insurance_declared_value_cents: insurance.declaredValueCents > 0 ? insurance.declaredValueCents : undefined,
          insurance_type: insurance.declaredValueCents > 0 && insurance.type !== "none" ? insurance.type : undefined,
          add_signature_confirmation: addSignatureConfirmation || undefined,
          slab_crack_count: cards.filter((c) => c.needs_slab_crack).length || undefined,
          pregrade_count: cards.filter((c) => c.needs_pregrade).length || undefined,
          signature_path: signaturePath,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        const msg = typeof data.error === "string" ? data.error : "Something went wrong. Please try again.";
        const code = typeof data.code === "string" ? data.code : "CHECKOUT_ERROR";
        // Use server-generated ref if available; fall back to client-generated
        const ref = typeof data.ref === "string" ? data.ref : `${code}-${Date.now().toString(36).toUpperCase()}`;
        setCheckoutError({ message: msg, ref });
        setSubmitting(false);
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    } catch (err) {
      console.error("Checkout fetch error:", err);
      const ref = `NETWORK_ERROR-${Date.now().toString(36).toUpperCase()}`;
      setCheckoutError({
        message: "Could not reach our server. Please check your internet connection and try again.",
        ref,
      });
      setSubmitting(false);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
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
              signatureDataUrl={signatureDataUrl}
              onSignatureChange={setSignatureDataUrl}
              insurance={insurance}
              onInsuranceChange={setInsurance}
              addSignatureConfirmation={addSignatureConfirmation}
              onSignatureConfirmationChange={setAddSignatureConfirmation}
              giftCardCode={giftCardCode}
              onGiftCardCodeChange={setGiftCardCode}
              giftCardAmountCents={giftCardAmountCents}
              onGiftCardAmountChange={setGiftCardAmountCents}
              instagramFeature={instagramFeature}
              onInstagramFeatureChange={setInstagramFeature}
              loyaltyDiscountPercent={loyaltyDiscountPercent}
              onLoyaltyDiscountChange={setLoyaltyDiscountPercent}
              onEditStep={(s) => {
                // remap review edit targets to new step numbers
                if (s === 2) setStep(1); // cards
                else if (s === 3) setStep(2); // customer
                else if (s === 4) setStep(3); // shipping
              }}
              selectedTier={selectedTier}
            />
          )}

          {step === 4 && checkoutError && (
            <div ref={errorRef} className="mt-8 bg-red-50 border-2 border-red-400 rounded-xl p-5 shadow-lg">
              <div className="flex gap-3">
                <div className="text-red-500 text-2xl shrink-0">⚠️</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-red-900 text-lg mb-1">Checkout failed</p>
                  <p className="text-red-800 text-sm mb-4 leading-relaxed">{checkoutError.message}</p>

                  <div className="bg-white border border-red-200 rounded-lg px-3 py-3 mb-4">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1.5">Error Reference</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm text-red-800 select-all break-all font-bold">{checkoutError.ref}</span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(`Error ref: ${checkoutError.ref}\n${checkoutError.message}`);
                          toast.success("Copied!");
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                    <p className="text-red-900 text-sm font-semibold mb-1">What to do:</p>
                    <p className="text-red-800 text-sm leading-relaxed">
                      Screenshot this screen and DM <strong>@the_card_doc</strong> on Instagram — include the error reference above and we&apos;ll complete your order manually right away.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diamond minimum value warning */}
          {step === 1 && isDiamondOrder && !diamondValueOk && (
            <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
              <span className="text-2xl shrink-0">💎</span>
              <div>
                <p className="font-bold text-amber-900 text-sm">Diamond tier requires $5,000+ in total card value</p>
                <p className="text-amber-800 text-sm mt-0.5">
                  Your current total is <strong>${(totalEstimatedValueCents() / 100).toLocaleString()}</strong>. Please enter estimated values for your cards totaling at least $5,000, or choose a different tier.
                </p>
              </div>
            </div>
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
              <Button onClick={handleSubmit} disabled={submitting || !signatureDataUrl} className="px-8">
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
              discountPercent={Math.max(discountPercent, loyaltyDiscountPercent)}
              isInternational={!!(customer.country && customer.country !== "US")}
              selectedTier={selectedTier}
              insurance={insurance}
              addSignatureConfirmation={addSignatureConfirmation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
