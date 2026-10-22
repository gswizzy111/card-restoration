"use client";

import { Info, ShieldCheck, ShieldOff } from "lucide-react";
import { INSURANCE_DECLINED_TEXT, INSURANCE_DETAILS, NOT_INSURED_TEXT } from "@/lib/legal/current-terms";
import { Need, Req } from "./required";

export type InsuranceElection = "purchased" | "declined" | null;

/**
 * The required shipping-insurance choice (Terms 13.3, 15.2, 15.4): buy it or
 * decline it, never assumed. `children` holds the purchase details (amount,
 * options and price) shown once "Buy" is chosen.
 */
export function InsuranceElectionBox({
  election,
  onElection,
  purchaseAvailable = true,
  unavailableNote,
  showMissing = false,
  purchaseMissing = false,
  children,
}: {
  election: InsuranceElection;
  onElection: (e: Exclude<InsuranceElection, null>) => void;
  purchaseAvailable?: boolean;
  unavailableNote?: string;
  /** The customer tried to go on: outline what's missing in red */
  showMissing?: boolean;
  /** "Buy" is chosen but the amount or coverage isn't filled in yet */
  purchaseMissing?: boolean;
  children?: React.ReactNode;
}) {
  const option = (value: Exclude<InsuranceElection, null>, label: string, Icon: typeof ShieldCheck, disabled = false) => (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed border-border" : election === value ? "border-primary bg-primary/5 cursor-pointer" : "border-border hover:border-primary/50 cursor-pointer"
      }`}
    >
      <input
        type="radio"
        name="insurance-election"
        className="mt-0.5 accent-primary"
        checked={election === value}
        disabled={disabled}
        onChange={() => onElection(value)}
      />
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );

  return (
    <div className="flex flex-col gap-3" id="insurance-election">
      <div>
        <h3 className="font-medium text-foreground">Shipping insurance<Req /> <span className="text-xs font-normal text-muted-foreground">(choose one)</span></h3>
        <p className="text-xs text-muted-foreground mt-1">{NOT_INSURED_TEXT}</p>
      </div>
      <Need missing={showMissing && election === null} note="Choose to buy or decline shipping insurance.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {option("purchased", "Buy shipping insurance", ShieldCheck, !purchaseAvailable)}
          {option("declined", "Decline shipping insurance", ShieldOff)}
        </div>
      </Need>
      {!purchaseAvailable && unavailableNote && <p className="text-xs text-muted-foreground">{unavailableNote}</p>}
      {election === "purchased" && purchaseAvailable && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground leading-relaxed">
            {INSURANCE_DETAILS.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <Need missing={showMissing && purchaseMissing} note="Enter the amount to insure and pick a coverage." className="flex flex-col gap-3">
            {children}
          </Need>
        </div>
      )}
      {election === "declined" && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <Info className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} />
          {INSURANCE_DECLINED_TEXT}
        </p>
      )}
    </div>
  );
}
