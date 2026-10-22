"use client";

import { useState, useEffect, useRef } from "react";
import { SigningSection, emptySigning, signingReady, slabSigned, submittedSigning, type SigningState, type SlabCard } from "@/components/checkout/signing-section";
import { SlabAuthorizationDialog } from "@/components/checkout/slab-authorization-dialog";
import { MissingNote, Need, revealMissing } from "@/components/checkout/required";
import { emptyIdentity, identityPayload } from "@/components/checkout/card-identity-fields";
import type { InsuranceElection } from "@/components/checkout/insurance-election";
import { SIGN_BUTTON_LABEL } from "@/lib/legal/current-terms";
import { isHighValue } from "@/lib/legal/agreements-v1";
import { cardProblems } from "./step-cards";
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
    ...emptyIdentity(),
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
  // The signatures and consents for the Terms of Service v1.0 (components/checkout/signing-section.tsx)
  const [signing, setSigning] = useState<SigningState>(emptySigning());
  const [skippedSlabs, setSkippedSlabs] = useState<string[]>([]);
  // The card whose slab authorization pop-up is open
  const [slabDialogId, setSlabDialogId] = useState<string | null>(null);
  // Pressed Continue / sign with something missing: outline it in red
  const [showMissing, setShowMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insuranceElection, setInsuranceElection] = useState<InsuranceElection>(null);
  const [insurance, setInsurance] = useState<InsuranceSelection>({ declaredValueCents: 0, type: "none", chargeCents: 0 });
  const [addSignatureConfirmation, setAddSignatureConfirmation] = useState(false);
  const [tipCents, setTipCents] = useState(0);
  const [checkoutError, setCheckoutError] = useState<{ message: string; ref: string } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const DIAMOND_MIN_CENTS = 500_000; // $5,000

  function totalEstimatedValueCents(): number {
    return cards.reduce((sum, c) => {
      const v = c.estimated_value ? Math.round(parseFloat(c.estimated_value.replace(/[$,]/g, "")) * 100) : 0;
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }

  const cardValueCents = (c: CardEntry) => {
    const v = c.estimated_value ? Math.round(parseFloat(c.estimated_value.replace(/[$,]/g, "")) * 100) : 0;
    return isNaN(v) ? 0 : v;
  };
  const slabCardOf = (c: CardEntry, i: number): SlabCard => ({
    index: i,
    id: c.id,
    details: { card_name: c.card_name.trim(), ...identityPayload(c), declared_value_cents: cardValueCents(c) },
  });
  const slabCards: SlabCard[] = cards.flatMap((c, i) => (c.needs_slab_crack ? [slabCardOf(c, i)] : []));
  const slabDialogIndex = cards.findIndex((c) => c.id === slabDialogId);
  const slabDialogCard = slabDialogIndex >= 0 ? slabCardOf(cards[slabDialogIndex], slabDialogIndex) : null;
  const slabStatus = (cardId: string) => {
    const i = cards.findIndex((c) => c.id === cardId);
    return i >= 0 && slabSigned(signing, slabCardOf(cards[i], i));
  };
  const highValueCards = cards.filter((c) => isHighValue(cardValueCents(c))).map((c) => ({ name: c.card_name.trim(), valueCents: cardValueCents(c) }));
  const insuranceOk = insuranceElection === "declined"
    || (insuranceElection === "purchased" && insurance.declaredValueCents > 0 && insurance.type !== "none");
  const readyToSign = signingReady(signing, slabCards) && insuranceOk;

  // The paid Instagram feature needs the photo permission, and goes when it's unchecked
  function changeInstagramFeature(v: boolean) {
    setInstagramFeature(v);
    if (v) setSigning((s) => ({ ...s, media: true }));
  }
  function changeSigning(next: SigningState) {
    setSigning(next);
    if (!next.media && instagramFeature) setInstagramFeature(false);
  }
  // Picking slab cracking opens its authorization; closing it unsigned takes the slab off
  function closeSlabDialog(signed: boolean) {
    if (!signed && slabDialogId) setCards((cs) => cs.map((c) => (c.id === slabDialogId ? { ...c, needs_slab_crack: false } : c)));
    setSlabDialogId(null);
  }
  function skipSlab(index: number) {
    const name = cards[index]?.card_name.trim() || `Card ${index + 1}`;
    setCards((cs) => cs.map((c, i) => (i === index ? { ...c, needs_slab_crack: false } : c)));
    setSkippedSlabs((s) => [...s, name]);
  }
  function changeInsuranceElection(e: Exclude<InsuranceElection, null>) {
    setInsuranceElection(e);
    if (e === "declined") setInsurance((ins) => ({ ...ins, type: "none", chargeCents: 0 }));
  }

  const isDiamondOrder = selectedTier === "elite" || cards.some((c) => c.tier === "elite");
  const diamondValueOk = !isDiamondOrder || totalEstimatedValueCents() >= DIAMOND_MIN_CENTS;

  function canAdvance(): boolean {
    if (step === 1) {
      return cards.every((c) => cardProblems(c, selectedTier).length === 0) && diamondValueOk;
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

  function goToStep(n: number) {
    setShowMissing(false);
    setStep(n);
  }
  function tryContinue() {
    if (canAdvance()) return goToStep(step + 1);
    setShowMissing(true);
    revealMissing();
  }
  function trySign() {
    if (readyToSign) {
      setShowMissing(false);
      return handleSubmit();
    }
    setShowMissing(true);
    revealMissing();
  }

  async function handleSubmit() {
    fbq("track", "InitiateCheckout", { num_items: cards.length, currency: "USD" });
    setSubmitting(true);
    setCheckoutError(null);
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
            ...identityPayload(c),
            estimated_value_cents: cardValueCents(c),
            notes: c.notes || undefined,
            photo_urls: c.photo_urls,
            service_ids: [serviceId],
            tier: c.tier ?? selectedTier,
            needs_slab_crack: c.needs_slab_crack || undefined,
            needs_pregrade: !!c.needs_pregrade,
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
          insurance_election: insuranceElection,
          insurance_declared_value_cents: insuranceElection === "purchased" && insurance.declaredValueCents > 0 ? insurance.declaredValueCents : undefined,
          insurance_type: insuranceElection === "purchased" && insurance.declaredValueCents > 0 && insurance.type !== "none" ? insurance.type : undefined,
          add_signature_confirmation: addSignatureConfirmation || undefined,
          slab_crack_count: cards.filter((c) => c.needs_slab_crack).length || undefined,
          pregrade_count: cards.filter((c) => c.needs_pregrade).length || undefined,
          tip_cents: tipCents > 0 ? tipCents : undefined,
          ...submittedSigning(signing, slabCards),
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
      <SlabAuthorizationDialog card={slabDialogCard} state={signing} onChange={changeSigning} onClose={closeSlabDialog} />
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
              slabSigned={slabStatus}
              onOpenSlab={setSlabDialogId}
              showMissing={showMissing}
            />
          )}
          {step === 2 && <StepCustomer customer={customer} onChange={setCustomer} showMissing={showMissing} />}
          {step === 3 && (
            <StepShipping
              customer={customer}
              shippingMethod={shippingMethod}
              selectedRate={selectedRate}
              onMethodChange={(m) => {
                setShippingMethod(m);
                // What can be insured depends on who buys the label (step-review.tsx)
                setInsurance((ins) => ({ ...ins, type: "none", chargeCents: 0 }));
              }}
              onRateChange={setSelectedRate}
              showMissing={showMissing}
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
              signingSlot={
                <SigningSection
                  slabCards={slabCards}
                  highValueCards={highValueCards}
                  state={signing}
                  onChange={changeSigning}
                  onSkipSlab={skipSlab}
                  onOpenSlab={(i) => setSlabDialogId(cards[i]?.id ?? null)}
                  skippedSlabs={skippedSlabs}
                  mediaRequiredNote={instagramFeature ? "The Instagram feature you added needs the first permission; unchecking it removes the feature." : undefined}
                  showMissing={showMissing}
                />
              }
              insuranceElection={insuranceElection}
              onInsuranceElectionChange={changeInsuranceElection}
              insurance={insurance}
              onInsuranceChange={setInsurance}
              addSignatureConfirmation={addSignatureConfirmation}
              onSignatureConfirmationChange={setAddSignatureConfirmation}
              giftCardCode={giftCardCode}
              onGiftCardCodeChange={setGiftCardCode}
              giftCardAmountCents={giftCardAmountCents}
              onGiftCardAmountChange={setGiftCardAmountCents}
              instagramFeature={instagramFeature}
              onInstagramFeatureChange={changeInstagramFeature}
              loyaltyDiscountPercent={loyaltyDiscountPercent}
              onLoyaltyDiscountChange={setLoyaltyDiscountPercent}
              tipCents={tipCents}
              onTipCentsChange={setTipCents}
              onEditStep={(s) => {
                // remap review edit targets to new step numbers
                if (s === 2) goToStep(1); // cards
                else if (s === 3) goToStep(2); // customer
                else if (s === 4) goToStep(3); // shipping
              }}
              selectedTier={selectedTier}
              showMissing={showMissing}
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
            <Need missing={showMissing} note={null} className="mt-6">
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
              <span className="text-2xl shrink-0">💎</span>
              <div>
                <p className="font-bold text-amber-900 text-sm">Diamond tier requires $5,000+ in total card value</p>
                <p className="text-amber-800 text-sm mt-0.5">
                  Your current total is <strong>${(totalEstimatedValueCents() / 100).toLocaleString()}</strong>. Please enter estimated values for your cards totaling at least $5,000, or choose a different tier.
                </p>
              </div>
            </div>
            </Need>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => goToStep(step - 1)}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={tryContinue}>
                Continue
              </Button>
            ) : (
              <Button onClick={trySign} disabled={submitting} className="px-8">
                {submitting ? "Redirecting..." : SIGN_BUTTON_LABEL}
              </Button>
            )}
          </div>
          <MissingNote show={showMissing && (step === 4 ? !readyToSign : !canAdvance())} />
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
              instagramFeature={instagramFeature}
              giftCardAmountCents={giftCardAmountCents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
