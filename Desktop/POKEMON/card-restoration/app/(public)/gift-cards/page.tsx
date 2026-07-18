"use client";

import { useState } from "react";

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200];

export default function GiftCardsPage() {
  const [amountDollars, setAmountDollars] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");

  const [sendToRecipient, setSendToRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const effectiveAmountDollars = useCustom
    ? parseFloat(customAmount.replace(/[^0-9.]/g, "")) || null
    : amountDollars;

  const isValid =
    effectiveAmountDollars !== null &&
    effectiveAmountDollars >= 10 &&
    effectiveAmountDollars <= 1000 &&
    purchaserName.trim().length > 0 &&
    purchaserEmail.trim().length > 0 &&
    (!sendToRecipient || (recipientName.trim().length > 0 && recipientEmail.trim().length > 0));

  async function handleCheckout() {
    if (!isValid || !effectiveAmountDollars) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gift-cards/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: Math.round(effectiveAmountDollars * 100),
          purchaser_name: purchaserName.trim(),
          purchaser_email: purchaserEmail.trim(),
          recipient_name: sendToRecipient ? recipientName.trim() : purchaserName.trim(),
          recipient_email: sendToRecipient ? recipientEmail.trim() : purchaserEmail.trim(),
          personal_message: personalMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🎁</div>
          <h1 className="font-heading text-4xl font-bold text-foreground mb-3">Gift Cards</h1>
          <p className="text-lg text-muted-foreground">
            Give the gift of card restoration. The recipient gets a code they can apply at checkout.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-8 flex flex-col gap-6">

          {/* Amount selection */}
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Select Amount</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => { setAmountDollars(amt); setUseCustom(false); }}
                  className={`py-3 rounded-xl border-2 font-bold text-lg transition-colors ${
                    !useCustom && amountDollars === amt
                      ? "border-primary bg-primary text-white"
                      : "border-border text-foreground hover:border-primary"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setUseCustom(true); setAmountDollars(null); }}
              className={`w-full py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                useCustom
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              Custom amount
            </button>
            {useCustom && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount (10–1000)"
                  className="flex-1 h-11 border border-border rounded-lg px-3 text-lg focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Purchaser info */}
          <div className="border-t border-border pt-6">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Your Info</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
                placeholder="Your name"
                className="h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="email"
                value={purchaserEmail}
                onChange={(e) => setPurchaserEmail(e.target.value)}
                placeholder="Your email (we'll send you a receipt)"
                className="h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Send to recipient toggle */}
          <div className="border-t border-border pt-6">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={sendToRecipient}
                onChange={(e) => setSendToRecipient(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium text-foreground">Send the gift card directly to someone else</span>
            </label>
            {sendToRecipient && (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient's name"
                  className="h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Recipient's email"
                  className="h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
                <textarea
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  placeholder="Personal message (optional)"
                  rows={3}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={!isValid || loading}
            className="w-full py-4 bg-primary text-white font-bold text-lg rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {loading
              ? "Redirecting..."
              : effectiveAmountDollars
              ? `Purchase $${effectiveAmountDollars} Gift Card`
              : "Purchase Gift Card"
            }
          </button>

          <p className="text-xs text-muted-foreground text-center">
            The gift card code will be emailed immediately after purchase.
            Gift cards never expire and can be used on any restoration order.
          </p>
        </div>
      </div>
    </div>
  );
}
