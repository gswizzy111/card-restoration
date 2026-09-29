"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { RESTORATION_TIERS, getAllTiers } from "@/lib/restoration-tiers";
import type { RestorationTierId } from "@/lib/restoration-tiers";

const TIERS = getAllTiers();

type TierOrCustom = RestorationTierId | "custom" | "";
type CardRow = { id: string; name: string; tier: TierOrCustom };

function emptyCard(defaultTier: TierOrCustom): CardRow {
  return { id: crypto.randomUUID(), name: "", tier: defaultTier };
}

function tierPrice(tier: TierOrCustom): number | null {
  if (!tier || tier === "custom") return null;
  return RESTORATION_TIERS[tier as RestorationTierId].price_cents;
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

const TIER_NAME_MAP: Record<string, RestorationTierId> = {
  regular: "regular",
  expedited: "expedited",
  premium: "premium",
  "ultra premium": "ultra_premium",
  ultra_premium: "ultra_premium",
  ultrapremium: "ultra_premium",
  elite: "elite",
  diamond: "elite",
  "fast pass": "fast_pass",
  fast_pass: "fast_pass",
  fastpass: "fast_pass",
};

function mapTierString(raw: string): TierOrCustom {
  return TIER_NAME_MAP[raw.toLowerCase().trim()] ?? "";
}

function parseCSV(text: string, defaultTier: TierOrCustom): CardRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z ]/g, "").trim());
  const nameIdx = headers.findIndex((h) => h === "card name" || h === "name" || h === "card");
  if (nameIdx === -1) return [];

  const tierIdx = headers.findIndex((h) => h === "tier" || h === "service" || h === "service level" || h === "level");

  const rows: CardRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const rawName = cols[nameIdx] ?? "";
    const name = rawName.replace(/^["']|["']$/g, "").trim();
    if (!name) continue;

    let tier: TierOrCustom = defaultTier;
    if (tierIdx >= 0 && cols[tierIdx]) {
      const parsed = mapTierString(cols[tierIdx]);
      if (parsed) tier = parsed;
    }

    rows.push({ id: crypto.randomUUID(), name, tier });
  }
  return rows;
}

// ─── Muse prompt ──────────────────────────────────────────────────────────────

const MUSE_PROMPT = `I'm going to send you a photo of trading cards laid out on a flat surface. Please identify every card in the photo, reading them left to right, top to bottom — the same way you'd read a page.

For each card, record the full card name including the Pokémon or player name, set name, and card number if you can read it (for example: "Charizard Base Set Holo #4", "1986 Fleer Michael Jordan #57", "Pikachu 1st Edition Base Set #58").

Output the result as a CSV spreadsheet with this exact header line:
Card Name,Tier

Leave the Tier column blank for every card — I'll fill that in manually.

Output ONLY the CSV — no explanation, no commentary, just the data starting with the header row. Example:

Card Name,Tier
Charizard Base Set Holo #4,
1986 Fleer Michael Jordan #57,
Pikachu 1st Edition Base Set #58,`;

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualOrderForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Order type
  const [orderType, setOrderType] = useState<"online" | "dropoff">("dropoff");
  const [inboundMethod, setInboundMethod] = useState<"buy_label" | "self_ship">("buy_label");

  // Customer
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Shipping address (online + buy_label only)
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");

  // Order details
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [defaultTier, setDefaultTier] = useState<TierOrCustom>("");
  const [customPricePerCard, setCustomPricePerCard] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState<CardRow[]>([emptyCard("")]);

  // Spreadsheet import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ count: number } | null>(null);
  const [museCopied, setMuseCopied] = useState(false);

  function addCard() { setCards((p) => [...p, emptyCard(defaultTier)]); }
  function removeCard(id: string) { setCards((p) => p.filter((c) => c.id !== id)); }
  function updateCardName(id: string, value: string) {
    setCards((p) => p.map((c) => c.id === id ? { ...c, name: value } : c));
  }
  function updateCardTier(id: string, tier: TierOrCustom) {
    setCards((p) => p.map((c) => c.id === id ? { ...c, tier } : c));
  }

  function applyTierToAll(tier: TierOrCustom) {
    setDefaultTier(tier);
    setCards((p) => p.map((c) => ({ ...c, tier })));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text, defaultTier);
      if (parsed.length === 0) {
        setError('Could not read the spreadsheet. Make sure the first row has a "Card Name" column.');
        return;
      }
      const hasExisting = cards.some((c) => c.name.trim());
      if (hasExisting && !window.confirm(`Replace the current ${cards.filter(c => c.name.trim()).length} card(s) with ${parsed.length} from the spreadsheet?`)) return;
      setCards(parsed);
      setImportFeedback({ count: parsed.length });
      setShowImport(false);
      setTimeout(() => setImportFeedback(null), 4000);
    };
    reader.readAsText(file);
  }

  function copyMusePrompt() {
    navigator.clipboard.writeText(MUSE_PROMPT).then(() => {
      setMuseCopied(true);
      setTimeout(() => setMuseCopied(false), 2500);
    });
  }

  const filledCards = cards.filter((c) => c.name.trim());
  const customPriceCents = Math.round((parseFloat(customPricePerCard.replace(/[^0-9.]/g, "")) || 0) * 100);

  function cardPriceCents(card: CardRow): number {
    const tp = tierPrice(card.tier);
    if (tp !== null) return tp;
    return customPriceCents;
  }

  const totalCents = filledCards.reduce((sum, c) => sum + cardPriceCents(c), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (filledCards.length === 0) { setError("Add at least one card."); return; }
    if (orderType === "online" && !email) { setError("Email is required for online orders — needed to send the confirmation email."); return; }
    if (orderType === "online" && inboundMethod === "buy_label" && (!street1 || !city || !stateCode || !zip)) {
      setError("Full shipping address is required to generate a prepaid label.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          customer_name: name || undefined,
          customer_email: email || undefined,
          customer_phone: phone || undefined,
          inbound_method: orderType === "dropoff" ? "dropoff" : inboundMethod,
          ...(orderType === "online" && inboundMethod === "buy_label" ? {
            street1,
            street2: street2 || undefined,
            city,
            state: stateCode,
            zip,
          } : {}),
          order_date: orderDate,
          restoration_tier: (defaultTier && defaultTier !== "custom") ? defaultTier : undefined,
          price_per_card_cents: customPriceCents > 0 ? customPriceCents : undefined,
          due_date: dueDate || undefined,
          notes: notes || undefined,
          cards: filledCards.map((c) => ({
            card_name: c.name.trim(),
            tier: (c.tier && c.tier !== "custom") ? c.tier : undefined,
            price_per_card_cents: (tierPrice(c.tier) === null && customPriceCents > 0) ? customPriceCents : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSubmitting(false); return; }
      if (data.labelWarning) {
        setError(`Order created — but: ${data.labelWarning}`);
        setTimeout(() => router.push(`/admin/orders/${data.orderId}`), 3000);
        return;
      }
      router.push(`/admin/orders/${data.orderId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const label = "block text-xs font-semibold text-muted-foreground mb-1.5";
  const select = `${input} cursor-pointer`;

  const allSameTier = filledCards.length > 0 && filledCards.every((c) => c.tier === filledCards[0].tier);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">

      {/* Order Type */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Order Type</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderType("online")}
            className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors ${orderType === "online" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            <span className="text-lg">🌐</span>
            Online Order
          </button>
          <button
            type="button"
            onClick={() => setOrderType("dropoff")}
            className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold transition-colors ${orderType === "dropoff" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            <span className="text-lg">🏪</span>
            Drop-off
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {orderType === "online"
            ? "Customer couldn't complete checkout online. A confirmation email will be sent with shipping instructions."
            : "Cards are dropped off in person — no shipping needed. Order goes straight to restoration."}
        </p>
      </div>

      {/* Shipping — online only */}
      {orderType === "online" && (
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <h2 className="font-heading font-black text-base text-foreground">Inbound Shipping</h2>
          <div>
            <label className={label}>How are cards arriving?</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setInboundMethod("buy_label")}
                className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${inboundMethod === "buy_label" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                <span className="text-base">📦</span>
                We Generate Label
              </button>
              <button
                type="button"
                onClick={() => setInboundMethod("self_ship")}
                className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${inboundMethod === "self_ship" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                <span className="text-base">📬</span>
                They Ship Themselves
              </button>
            </div>
          </div>

          {inboundMethod === "buy_label" && (
            <>
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Enter the customer&apos;s address — we&apos;ll generate a prepaid USPS label and email it to them.</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={label}>Street Address</label>
                    <input className={input} value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="123 Main St" />
                  </div>
                  <div>
                    <label className={label}>Apt / Suite <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input className={input} value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apt 4B" />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className={label}>City</label>
                      <input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
                    </div>
                    <div>
                      <label className={label}>State</label>
                      <select className={select} value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                        <option value="">—</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={label}>ZIP Code</label>
                      <input className={input} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="10001" maxLength={10} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {inboundMethod === "self_ship" && (
            <p className="text-xs text-muted-foreground">The confirmation email will include our mailing address. No label generated.</p>
          )}
        </div>
      )}

      {/* Customer */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-base text-foreground">Customer</h2>
          <span className="text-xs text-muted-foreground">
            {orderType === "online" ? "Email required" : "All optional"}
          </span>
        </div>
        <div>
          <label className={label}>Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>
              Email {orderType === "online" && <span className="text-red-500">*</span>}
            </label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>
        </div>
      </div>

      {/* Order Date */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Order Date</h2>
        <div>
          <label className={label}>Date Taken <span className="text-muted-foreground font-normal">(for backdating)</span></label>
          <input className={input} type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
        </div>
      </div>

      {/* Tier */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Service Tier</h2>
        <div>
          <label className={label}>Apply to all cards</label>
          <select className={select} value={defaultTier} onChange={(e) => applyTierToAll(e.target.value as TierOrCustom)}>
            <option value="">— No Tier / Custom Price —</option>
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {fmt(t.price_cents)}/card
              </option>
            ))}
            <option value="custom">Custom Price</option>
          </select>
        </div>
        {(defaultTier === "custom" || defaultTier === "") && (
          <div>
            <label className={label}>Custom Price per Card <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                className={`${input} pl-7`}
                type="number"
                min="0"
                step="0.01"
                value={customPricePerCard}
                onChange={(e) => setCustomPricePerCard(e.target.value)}
                placeholder="75.00"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-black text-base text-foreground">Cards</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className={`text-xs font-semibold px-3 h-8 rounded-lg border transition-colors flex items-center gap-1.5 ${showImport ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
            >
              📋 Spreadsheet Import
            </button>
            <button type="button" onClick={addCard} className="text-sm font-semibold text-primary hover:text-primary/80">
              + Add Card
            </button>
          </div>
        </div>

        {/* Spreadsheet import panel */}
        {showImport && (
          <div className="border-2 border-dashed border-blue-200 rounded-xl bg-blue-50 p-4 flex flex-col gap-4">

            {/* Step 1 — Copy Muse prompt */}
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Step 1 — Copy this prompt into Meta Muse, then send your photo</p>
              <div className="bg-white border border-blue-200 rounded-lg p-3 relative">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{MUSE_PROMPT}</pre>
                <button
                  type="button"
                  onClick={copyMusePrompt}
                  className="mt-3 text-xs font-bold px-3 h-7 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {museCopied ? "✓ Copied!" : "Copy Prompt"}
                </button>
              </div>
            </div>

            {/* Step 2 — Upload CSV */}
            <div>
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Step 2 — Upload the CSV Muse gives you</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-12 rounded-xl border-2 border-blue-300 bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                📂 Choose CSV File
              </button>
              <p className="text-xs text-blue-600 mt-1.5 text-center">
                Accepts .csv — first row must have a &ldquo;Card Name&rdquo; column
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Import success feedback */}
        {importFeedback && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs font-semibold text-green-800">
            ✓ Imported {importFeedback.count} card{importFeedback.count !== 1 ? "s" : ""} from spreadsheet
          </div>
        )}

        {cards.map((card, i) => {
          const price = cardPriceCents(card);
          return (
            <div key={card.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0 text-right">{i + 1}.</span>
                <input
                  className={`${input} flex-1`}
                  value={card.name}
                  onChange={(e) => updateCardName(card.id, e.target.value)}
                  placeholder="Card name (e.g. Charizard Base Set)"
                />
                {cards.length > 1 && (
                  <button type="button" onClick={() => removeCard(card.id)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
                )}
              </div>
              <div className="flex items-center gap-2 pl-8">
                <select
                  className="flex-1 h-8 border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-primary transition-colors bg-white cursor-pointer"
                  value={card.tier}
                  onChange={(e) => updateCardTier(card.id, e.target.value as TierOrCustom)}
                >
                  <option value="">— Inherit from order —</option>
                  {TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {fmt(t.price_cents)}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {price > 0 && (
                  <span className="text-xs font-semibold text-primary shrink-0">{fmt(price)}</span>
                )}
              </div>
            </div>
          );
        })}

        {filledCards.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
            <span className="text-sm text-muted-foreground">
              {filledCards.length} card{filledCards.length !== 1 ? "s" : ""}
              {allSameTier && filledCards[0].tier && filledCards[0].tier !== "custom" && (
                <span className="ml-1 text-xs">({RESTORATION_TIERS[filledCards[0].tier as RestorationTierId]?.name})</span>
              )}
            </span>
            <span className="text-xl font-black text-foreground">{totalCents > 0 ? fmt(totalCents) : "—"}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-base text-foreground">Timeline</h2>
        <div>
          <label className={label}>Due Date <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-2">
        <label className="font-heading font-black text-base text-foreground">Notes <span className="text-muted-foreground font-normal text-sm">(optional)</span></label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors bg-white resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Special instructions, context, etc."
        />
      </div>

      {error && (
        <div className={`text-sm font-medium px-4 py-3 rounded-lg border ${error.startsWith("Order created") ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <a href="/admin" className="h-10 px-5 border border-border rounded-lg text-sm font-semibold text-foreground flex items-center hover:bg-secondary transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="h-10 px-8 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting
            ? orderType === "online" && inboundMethod === "buy_label"
              ? "Generating Label..."
              : "Creating..."
            : `Create ${orderType === "online" ? "Online" : "Drop-off"} Order`}
        </button>
      </div>
    </form>
  );
}
