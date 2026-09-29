"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { PhotoUploader } from "@/components/order-builder/photo-uploader";

type CardRow = {
  id: string;
  name: string;
  declaredValueDollars: string;
  photoUrls: string[];
};

type ShippingRate = {
  id: string;
  carrier: string;
  service: string;
  amount_cents: number;
  estimated_days: number | null;
  duration_terms: string | null;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "NZ", name: "New Zealand" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "KR", name: "South Korea" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "VN", name: "Vietnam" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "GR", name: "Greece" },
  { code: "TR", name: "Turkey" },
  { code: "IE", name: "Ireland" },
  { code: "HR", name: "Croatia" },
];

const HIGH_VALUE_THRESHOLD_CENTS = 150000; // $1,500
const NJ_TAX_RATE = 0.06625;

function estimateInsuranceCents(declaredValueCents: number): number {
  if (declaredValueCents <= 0) return 0;
  return Math.max(100, Math.round(declaredValueCents * 0.015));
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function emptyCard(): CardRow {
  return { id: crypto.randomUUID(), name: "", declaredValueDollars: "", photoUrls: [] };
}

function etaLabel(rate: ShippingRate): string {
  if (rate.estimated_days !== null) {
    return rate.estimated_days === 1 ? "1 business day" : `${rate.estimated_days} business days`;
  }
  return rate.duration_terms ?? "Delivery time varies";
}

interface PrepOrderFormProps {
  standardPriceCents: number;
  preGradePriceCents: number;
  slabCrackPriceCents: number;
}

export function PrepOrderForm({ standardPriceCents, preGradePriceCents, slabCrackPriceCents }: PrepOrderFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Customer
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Cards
  const [cards, setCards] = useState<CardRow[]>([emptyCard()]);

  // Add-ons
  const [addPreGrade, setAddPreGrade] = useState(false);
  const [slabCrackCount, setSlabCrackCount] = useState(0);

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<"buy_label" | "self_ship">("buy_label");
  const [country, setCountry] = useState("US");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");

  // Rate fetching
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [ratesFetchedFor, setRatesFetchedFor] = useState("");
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // Insurance
  const [addInsurance, setAddInsurance] = useState(false);
  const [insuranceValueDollars, setInsuranceValueDollars] = useState("");

  const [notes, setNotes] = useState("");
  const [socialHandle, setSocialHandle] = useState("");

  const isInternational = country !== "US";

  function resetAddress() {
    setSelectedRate(null);
    setRates([]);
    setRatesFetchedFor("");
  }

  function addCard() { setCards((p) => [...p, emptyCard()]); }
  function removeCard(id: string) { setCards((p) => p.filter((c) => c.id !== id)); }
  function updateCardName(id: string, v: string) { setCards((p) => p.map((c) => c.id === id ? { ...c, name: v } : c)); }
  function updateCardValue(id: string, v: string) { setCards((p) => p.map((c) => c.id === id ? { ...c, declaredValueDollars: v } : c)); }
  function updateCardPhotos(id: string, urls: string[]) { setCards((p) => p.map((c) => c.id === id ? { ...c, photoUrls: urls } : c)); }

  const filledCards = cards.filter((c) => c.name.trim());

  function cardValueCents(card: CardRow): number {
    return Math.round((parseFloat(card.declaredValueDollars.replace(/[^0-9.]/g, "")) || 0) * 100);
  }

  function cardPrepCents(card: CardRow): number {
    const val = cardValueCents(card);
    if (val >= HIGH_VALUE_THRESHOLD_CENTS) return Math.round(val * 0.02);
    return standardPriceCents;
  }

  function cardPriceLabel(card: CardRow): string {
    const val = cardValueCents(card);
    if (val === 0) return fmt(standardPriceCents);
    if (val >= HIGH_VALUE_THRESHOLD_CENTS) return `${fmt(Math.round(val * 0.02))} (2%)`;
    return fmt(standardPriceCents);
  }

  const prepSubtotal = filledCards.reduce((sum, c) => sum + cardPrepCents(c), 0);
  const preGradeSubtotal = addPreGrade ? filledCards.length * preGradePriceCents : 0;
  const slabCrackSubtotal = slabCrackCount * slabCrackPriceCents;
  const serviceSubtotal = prepSubtotal + preGradeSubtotal + slabCrackSubtotal;
  // No NJ tax for international orders
  const taxCents = isInternational ? 0 : Math.round(serviceSubtotal * NJ_TAX_RATE);
  // ×2: customer pays inbound label + return label
  const shippingCents = (selectedRate?.amount_cents ?? 0) * 2;
  const insuranceDeclaredValueCents = addInsurance ? Math.round((parseFloat(insuranceValueDollars) || 0) * 100) : 0;
  const estimatedInsuranceCents = estimateInsuranceCents(insuranceDeclaredValueCents);
  const totalEstimate = serviceSubtotal + taxCents + shippingCents + estimatedInsuranceCents;
  const totalDeclaredValueCents = filledCards.reduce((sum, c) => sum + cardValueCents(c), 0);

  const addressFingerprint = [country, street1.trim(), city.trim(), stateCode.trim(), zip.trim()].join("|");
  const addressComplete = !!(
    street1.trim() && city.trim() && zip.trim() &&
    (isInternational || stateCode) // state required for US, optional for international
  );
  const addressChangedSinceFetch = rates.length > 0 && ratesFetchedFor !== addressFingerprint;

  const fetchRates = useCallback(async () => {
    setRatesError("");
    setRatesLoading(true);
    setSelectedRate(null);
    const totalValueUsd = totalDeclaredValueCents > 0 ? totalDeclaredValueCents / 100 : filledCards.length * 25;
    try {
      const res = await fetch("/api/prep/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street1: street1.trim(),
          street2: street2.trim() || undefined,
          city: city.trim(),
          state: stateCode.trim() || undefined,
          zip: zip.trim(),
          country,
          card_count: Math.max(1, filledCards.length),
          total_value_usd: totalValueUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.rates) {
        setRatesError(data.error ?? "Could not fetch rates. Please try again.");
        setRates([]);
      } else {
        setRates(data.rates as ShippingRate[]);
        setRatesFetchedFor(addressFingerprint);
      }
    } catch {
      setRatesError("Network error fetching rates. Please try again.");
      setRates([]);
    } finally {
      setRatesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street1, street2, city, stateCode, zip, country, addressFingerprint, filledCards.length, totalDeclaredValueCents]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (filledCards.length < 1) { setError("Please add at least one card."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!phone.trim()) { setError("Phone is required."); return; }
    if (shippingMethod === "buy_label") {
      if (!street1.trim() || !city.trim() || !zip.trim()) {
        setError("Full address is required to generate a prepaid label.");
        return;
      }
      if (!isInternational && !stateCode) {
        setError("State is required for US addresses.");
        return;
      }
      if (!selectedRate) {
        setError("Please check shipping rates and select an option before continuing.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/prep/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          cards: filledCards.map((c) => ({
            card_name: c.name.trim(),
            declared_value_cents: cardValueCents(c),
            photo_urls: c.photoUrls,
          })),
          add_pre_grade: addPreGrade,
          slab_crack_count: slabCrackCount,
          shipping_method: shippingMethod,
          ...(shippingMethod === "buy_label" ? {
            country,
            street1: street1.trim(),
            street2: street2.trim() || undefined,
            city: city.trim(),
            state: stateCode.trim() || undefined,
            zip: zip.trim(),
            shipping_rate_object_id: selectedRate?.id,
            shipping_amount_cents: (selectedRate?.amount_cents ?? 0) * 2,
            add_insurance: addInsurance,
            insurance_amount_cents: insuranceDeclaredValueCents,
          } : {}),
          social_handle: socialHandle.trim() || undefined,
          customer_notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      try { window.location.href = data.url; } catch { setSubmitting(false); }
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1.5";
  const selectCls = `${input} cursor-pointer`;

  return (
    <div className="max-w-xl mx-auto px-6 py-12 md:py-16">
      <div className="mb-8">
        <Link href="/prep" className="text-xs text-primary font-semibold hover:underline">← Back to Prep Pricing</Link>
        <h1 className="font-heading text-3xl font-black text-foreground mt-3 mb-1">Prep Order</h1>
        <p className="text-sm text-muted-foreground">
          Cards under $1,500: {fmt(standardPriceCents)}/card &nbsp;·&nbsp; Cards $1,500+: 2% of declared value
        </p>
      </div>

      {/* Not-included disclaimer */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-2">
        <p className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Prep does not include:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {["Crease work", "Edge & corner work", "Dent removal", "Any restorative work"].map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-red-700">
              <span className="font-black text-red-500 leading-none">✕</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-red-600 mt-2">
          Need restoration? <Link href="/tier-selection" className="font-semibold underline hover:text-red-800">See our Restoration tiers →</Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-6">

        {/* Customer */}
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <h2 className="font-heading font-black text-base text-foreground">Your Info</h2>
          <div>
            <label className={labelCls}>Full Name *</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email *</label>
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone *</label>
              <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 555-5555" />
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-black text-base text-foreground">Cards</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Enter value for cards $1,500+</p>
            </div>
            <button type="button" onClick={addCard} className="text-sm font-semibold text-primary hover:text-primary/80">
              + Add Card
            </button>
          </div>

          {cards.map((card, i) => (
            <div key={card.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <input
                  className={`${input} flex-1`}
                  value={card.name}
                  onChange={(e) => updateCardName(card.id, e.target.value)}
                  placeholder="Card name (e.g. Charizard Base Set Holo)"
                />
                {cards.length > 1 && (
                  <button type="button" onClick={() => removeCard(card.id)} className="text-red-400 hover:text-red-600 text-xl leading-none shrink-0">×</button>
                )}
              </div>
              <div className="flex items-center gap-2 pl-7">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    className="w-full h-8 border border-border rounded-lg pl-6 pr-3 text-xs focus:outline-none focus:border-primary transition-colors bg-white"
                    type="number" min="0" step="1"
                    value={card.declaredValueDollars}
                    onChange={(e) => updateCardValue(card.id, e.target.value)}
                    placeholder="Declared value (optional — required if $1,500+)"
                  />
                </div>
                {card.name.trim() && (
                  <span className={`text-xs font-semibold shrink-0 w-24 text-right ${cardValueCents(card) >= HIGH_VALUE_THRESHOLD_CENTS ? "text-amber-600" : "text-primary"}`}>
                    {cardPriceLabel(card)}/card
                  </span>
                )}
              </div>
              <div className="pl-7">
                <p className="text-xs text-muted-foreground mb-1.5">Photos <span className="text-muted-foreground/60">(optional)</span></p>
                <PhotoUploader photoUrls={card.photoUrls} onChange={(urls) => updateCardPhotos(card.id, urls)} max={4} />
              </div>
            </div>
          ))}

          {filledCards.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
              <span className="text-sm text-muted-foreground">{filledCards.length} card{filledCards.length !== 1 ? "s" : ""}</span>
              <span className="text-lg font-black text-foreground">{fmt(prepSubtotal)}</span>
            </div>
          )}
        </div>

        {/* Add-ons */}
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <h2 className="font-heading font-black text-base text-foreground">Add-Ons</h2>

          <button
            type="button"
            onClick={() => setAddPreGrade((v) => !v)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${addPreGrade ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${addPreGrade ? "border-primary bg-primary" : "border-border"}`}>
              {addPreGrade && <span className="text-white text-xs font-black">✓</span>}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-foreground">Pre-Grade Assessment</span>
                <span className="text-xs font-bold text-primary">+{fmt(preGradePriceCents)}/card</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">We estimate each card&apos;s grade before you submit — so you know what to expect.</p>
            </div>
            {addPreGrade && filledCards.length > 0 && (
              <span className="text-sm font-black text-primary shrink-0">{fmt(preGradeSubtotal)}</span>
            )}
          </button>

          <div className="border border-border rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-lg">🪨</span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-foreground">Slab Crack</span>
                  <span className="text-xs font-bold text-primary">+{fmt(slabCrackPriceCents)}/card</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Need us to crack graded slabs before prepping? Enter how many.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                className={`${input} w-24`}
                type="number" min="0" max="50"
                value={slabCrackCount || ""}
                onChange={(e) => setSlabCrackCount(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
              />
              {slabCrackCount > 0 && (
                <span className="text-sm font-semibold text-primary">{slabCrackCount} × {fmt(slabCrackPriceCents)} = {fmt(slabCrackSubtotal)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <h2 className="font-heading font-black text-base text-foreground">Shipping Your Cards To Us</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShippingMethod("buy_label")}
              className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${shippingMethod === "buy_label" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              <span className="text-base">📦</span>Prepaid Label
            </button>
            <button type="button" onClick={() => setShippingMethod("self_ship")}
              className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${shippingMethod === "self_ship" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              <span className="text-base">📬</span>Ship Myself
            </button>
          </div>

          {shippingMethod === "buy_label" && (
            <div className="flex flex-col gap-4">
              <div className="border-t border-border pt-4 flex flex-col gap-3">

                {/* Country selector — always first */}
                <div>
                  <label className={labelCls}>Country *</label>
                  <select
                    className={selectCls}
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setStateCode(""); resetAddress(); }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Street Address *</label>
                  <input className={input} value={street1} onChange={(e) => { setStreet1(e.target.value); setSelectedRate(null); }} placeholder="123 Main St" />
                </div>
                <div>
                  <label className={labelCls}>Apt / Suite / Unit <span className="font-normal">(optional)</span></label>
                  <input className={input} value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apt 4B" />
                </div>

                {!isInternational ? (
                  /* US: city / state dropdown / zip */
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>City *</label>
                      <input className={input} value={city} onChange={(e) => { setCity(e.target.value); setSelectedRate(null); }} placeholder="New York" />
                    </div>
                    <div>
                      <label className={labelCls}>State *</label>
                      <select className={selectCls} value={stateCode} onChange={(e) => { setStateCode(e.target.value); setSelectedRate(null); }}>
                        <option value="">—</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>ZIP Code *</label>
                      <input className={input} value={zip} onChange={(e) => { setZip(e.target.value); setSelectedRate(null); }} placeholder="10001" maxLength={10} />
                    </div>
                  </div>
                ) : (
                  /* International: city / state text (optional) / postal code */
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>City *</label>
                      <input className={input} value={city} onChange={(e) => { setCity(e.target.value); setSelectedRate(null); }} placeholder="Singapore" />
                    </div>
                    <div>
                      <label className={labelCls}>State / Province <span className="font-normal">(optional)</span></label>
                      <input className={input} value={stateCode} onChange={(e) => { setStateCode(e.target.value); setSelectedRate(null); }} placeholder="—" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Postal Code *</label>
                      <input className={input} value={zip} onChange={(e) => { setZip(e.target.value); setSelectedRate(null); }} placeholder="123456" maxLength={12} />
                    </div>
                  </div>
                )}
              </div>

              {addressComplete && (
                <div className="flex flex-col gap-3">
                  {isInternational ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                      <strong>International shipping — important:</strong> You will receive a prepaid label and customs forms after checkout. You must bring your package to a carrier counter or post office in person — do not drop in a mailbox. Shipping cost covers both the inbound label (you to us) and the return shipment (us back to you).
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
                      <strong>Shipping price covers both ways.</strong> You&apos;re paying for your label to send cards to us <em>and</em> the return shipment back to you — two labels, billed up front.
                    </div>
                  )}

                  {(rates.length === 0 || addressChangedSinceFetch) && !ratesLoading && (
                    <button type="button" onClick={fetchRates}
                      className="h-10 w-full border-2 border-primary text-primary text-sm font-bold rounded-xl hover:bg-primary/5 transition-colors">
                      {addressChangedSinceFetch ? "Refresh Shipping Rates" : "Check Shipping Rates"}
                    </button>
                  )}

                  {ratesLoading && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Fetching rates…
                    </div>
                  )}

                  {ratesError && (
                    <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{ratesError}</div>
                  )}

                  {rates.length > 0 && !addressChangedSinceFetch && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Select a shipping option:</p>
                      {rates.map((rate) => (
                        <button key={rate.id} type="button" onClick={() => setSelectedRate(rate)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors ${selectedRate?.id === rate.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedRate?.id === rate.id ? "border-primary" : "border-border"}`}>
                              {selectedRate?.id === rate.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{rate.service}</p>
                              <p className="text-xs text-muted-foreground">{etaLabel(rate)}</p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-foreground">{fmt(rate.amount_cents * 2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border border-border rounded-xl p-4">
                <button type="button"
                  onClick={() => {
                    setAddInsurance((v) => !v);
                    if (!addInsurance && insuranceValueDollars === "" && totalDeclaredValueCents > 0) {
                      setInsuranceValueDollars((totalDeclaredValueCents / 100).toFixed(0));
                    }
                  }}
                  className="w-full flex items-center gap-3 text-left">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${addInsurance ? "border-primary bg-primary" : "border-border"}`}>
                    {addInsurance && <span className="text-white text-xs font-black">✓</span>}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">Insure my shipment</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Covers loss or damage while your cards are in transit to us.</div>
                  </div>
                </button>
                {addInsurance && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <label className={labelCls}>Declared Insurance Value (USD) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input className={`${input} pl-7`} type="number" min="0" step="1"
                        value={insuranceValueDollars} onChange={(e) => setInsuranceValueDollars(e.target.value)}
                        placeholder="Total value of cards in this shipment (USD)" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Insurance cost is included in your total at checkout.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {shippingMethod === "self_ship" && (
            <p className="text-xs text-muted-foreground">After checkout you&apos;ll receive our mailing address. Ship using any tracked, insured method and include your order number inside the package.</p>
          )}
        </div>

        {/* Feature suggestion */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">📸</span>
            <div>
              <p className="text-sm font-black text-slate-800 leading-tight">Want to be featured?</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Drop your Instagram or Facebook handle and we may share your before &amp; after results with the community.
              </p>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">@</span>
            <input
              className="w-full h-10 border border-blue-200 rounded-lg pl-7 pr-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white"
              value={socialHandle}
              onChange={(e) => setSocialHandle(e.target.value.replace(/^@/, ""))}
              placeholder="yourhandle  (optional)"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-2">
          <label className="font-heading font-black text-base text-foreground">
            Notes <span className="text-muted-foreground font-normal text-sm">(optional)</span>
          </label>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors bg-white resize-none"
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Special instructions, condition notes, etc." />
        </div>

        {/* Order Summary */}
        <div className="bg-slate-50 rounded-xl border border-border p-5">
          <h2 className="font-heading font-black text-sm text-foreground mb-3">Order Summary</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            {filledCards.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prep ({filledCards.length} card{filledCards.length !== 1 ? "s" : ""})</span>
                <span className="font-semibold">{fmt(prepSubtotal)}</span>
              </div>
            )}
            {addPreGrade && filledCards.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-Grade Assessment × {filledCards.length}</span>
                <span className="font-semibold">{fmt(preGradeSubtotal)}</span>
              </div>
            )}
            {slabCrackCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slab Crack × {slabCrackCount}</span>
                <span className="font-semibold">{fmt(slabCrackSubtotal)}</span>
              </div>
            )}
            {taxCents > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">NJ Sales Tax (6.625%)</span>
                <span className="font-semibold">{fmt(taxCents)}</span>
              </div>
            )}
            {shippingMethod === "buy_label" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping (inbound + return)</span>
                {selectedRate
                  ? <span className="font-semibold">{fmt(shippingCents)}</span>
                  : <span className="text-xs font-semibold text-muted-foreground">select above</span>}
              </div>
            )}
            {addInsurance && insuranceDeclaredValueCents > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipment Insurance (~1.5% of value)</span>
                <span className="font-semibold">{fmt(estimatedInsuranceCents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border mt-1">
              <span className="font-black text-foreground">
                {shippingMethod === "buy_label" && !selectedRate ? "Subtotal" : "Total"}
              </span>
              <span className="font-black text-foreground text-lg">{totalEstimate > 0 ? fmt(totalEstimate) : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {shippingMethod === "buy_label" && !selectedRate
                ? "* Select a shipping option above to see your full total."
                : isInternational
                  ? "* All amounts in USD. Confirmed at Stripe checkout."
                  : "* Includes NJ sales tax. Confirmed at Stripe checkout."}
            </p>
          </div>
        </div>

        {error && (
          <div className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="h-12 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {submitting ? "Redirecting to checkout…" : "Proceed to Checkout →"}
        </button>
      </form>
    </div>
  );
}
