"use client";

import { useState } from "react";
import Link from "next/link";
import { Gem } from "lucide-react";

const RATE = 0.07;
const MIN_VALUE = 5000;

export function DiamondCard({
  slotsLeft,
  isSoldOut,
  restorationsOpen,
}: {
  slotsLeft: number | null;
  isSoldOut: boolean;
  restorationsOpen: boolean;
}) {
  const [rawValue, setRawValue] = useState("");

  const numericValue = parseFloat(rawValue.replace(/[^0-9.]/g, "")) || 0;
  const priceDollars = numericValue >= MIN_VALUE ? (numericValue * RATE).toFixed(2) : null;
  const tooLow = rawValue !== "" && numericValue > 0 && numericValue < MIN_VALUE;

  const bannerLabel = isSoldOut
    ? "SOLD OUT"
    : slotsLeft !== null
    ? `${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} remaining`
    : "White Glove";

  const bannerCls = isSoldOut
    ? "bg-gray-400 text-white"
    : slotsLeft !== null
    ? slotsLeft <= 3 ? "bg-red-500 text-white" : "bg-orange-500 text-white"
    : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white";

  return (
    <div className={`relative rounded-xl overflow-hidden transition-all duration-200 flex flex-col border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-100 hover:shadow-xl ${(isSoldOut || !restorationsOpen) ? "opacity-60" : ""}`}>
      <div className={`text-xs font-bold text-center py-1.5 tracking-wide ${bannerCls}`}>
        {bannerLabel}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-5">
          <Gem className="w-7 h-7 flex-shrink-0 mt-0.5 text-cyan-600" />
          <div>
            <h3 className="font-heading text-2xl font-bold text-foreground leading-tight">Diamond</h3>
            <p className="text-sm text-muted-foreground mt-0.5">White-glove service for high-value cards</p>
          </div>
        </div>

        {/* Dynamic price display */}
        <div className="mb-4">
          <div className="text-4xl font-bold text-cyan-700">
            {priceDollars ? `$${priceDollars}` : "7%"}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {priceDollars
              ? `of your $${numericValue.toLocaleString()} card value`
              : "of declared card value · cards $5,000+"}
          </p>
        </div>

        {/* Value input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
            Estimated card value (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 6000"
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-cyan-200 bg-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
            />
          </div>
          {tooLow && (
            <p className="text-xs text-amber-600 font-semibold mt-1.5">
              Diamond requires cards valued at $5,000+. Consider Fast Pass for cards under $5,000.
            </p>
          )}
          {priceDollars && (
            <p className="text-xs text-cyan-700 font-semibold mt-1.5">
              Your price: <span className="text-lg font-black">${priceDollars}</span> per card
            </p>
          )}
        </div>

        {/* CTA */}
        {isSoldOut ? (
          <div className="w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm bg-gray-200 text-gray-500 cursor-not-allowed mb-6">
            Sold Out
          </div>
        ) : !restorationsOpen ? (
          <div className="w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm cursor-not-allowed mb-6 bg-cyan-100 text-cyan-700">
            Currently Closed
          </div>
        ) : (
          <Link
            href="/restoration?tier=elite"
            className="w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm block transition-all duration-150 mb-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90"
          >
            Select Diamond
          </Link>
        )}

        {/* Features */}
        <div className="border-t border-black/10 pt-4 space-y-2.5 flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Turnaround</span>
            <span className="font-medium text-foreground">5–10 business days <span className="text-xs text-muted-foreground">(est.)</span></span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Card value</span>
            <span className="font-medium text-foreground">$5,000+</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-cyan-500">✓</span>
            <span className="text-muted-foreground">Grader notes included</span>
          </div>
        </div>
      </div>
    </div>
  );
}
