"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GRADING_COMPANIES } from "@/lib/legal/agreements-v1";
import { Need, Req } from "./required";

/** The identifying details for one card (Terms Section 3.2), besides its name, value and photos. */
export type CardIdentity = {
  card_set: string;
  card_year: string;
  card_number: string;
  variation: string;
  grading_company: string;
  grade: string;
  cert_number: string;
  known_defects: string;
};

export const emptyIdentity = (): CardIdentity => ({
  card_set: "", card_year: "", card_number: "", variation: "", grading_company: "", grade: "", cert_number: "", known_defects: "",
});

/** For the API: trimmed, empty fields left out. */
export function identityPayload(c: Partial<CardIdentity>) {
  const out: Record<string, string> = {};
  for (const k of ["card_set", "card_year", "card_number", "variation", "grading_company", "grade", "cert_number", "known_defects"] as const) {
    const v = c[k]?.trim();
    if (v) out[k] = v;
  }
  return out;
}

const SELECT = "w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function CardIdentityFields({
  value,
  onChange,
  idPrefix,
  needsCert = false,
  showMissing = false,
}: {
  value: CardIdentity;
  onChange: (patch: Partial<CardIdentity>) => void;
  idPrefix: string;
  /** Slab removal is selected: the grading company and cert number are required. */
  needsCert?: boolean;
  /** The customer tried to go on: outline what's missing in red */
  showMissing?: boolean;
}) {
  const graded = !!value.grading_company || needsCert;
  const missingCert = needsCert && (!value.grading_company || !value.cert_number.trim());
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-set`}>Set</Label>
        <Input id={`${idPrefix}-set`} placeholder="e.g. Base Set" value={value.card_set} onChange={(e) => onChange({ card_set: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <Input id={`${idPrefix}-year`} placeholder="e.g. 1999" inputMode="numeric" value={value.card_year} onChange={(e) => onChange({ card_year: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-num`}>Card number</Label>
        <Input id={`${idPrefix}-num`} placeholder="e.g. 4/102" value={value.card_number} onChange={(e) => onChange({ card_number: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-var`}>Variation</Label>
        <Input id={`${idPrefix}-var`} placeholder="e.g. 1st Edition, Holo, Refractor" value={value.variation} onChange={(e) => onChange({ variation: e.target.value })} />
      </div>
      <Need missing={showMissing && needsCert && !value.grading_company} className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-company`}>Grading company{needsCert && <Req />}</Label>
        <select
          id={`${idPrefix}-company`}
          className={SELECT}
          value={value.grading_company}
          onChange={(e) => onChange(e.target.value ? { grading_company: e.target.value } : { grading_company: "", grade: "", cert_number: "" })}
        >
          <option value="">{needsCert ? "Choose…" : "Not graded (raw)"}</option>
          {GRADING_COMPANIES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Need>
      {graded && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-grade`}>Grade</Label>
          <Input id={`${idPrefix}-grade`} placeholder="e.g. 9" value={value.grade} onChange={(e) => onChange({ grade: e.target.value })} />
        </div>
      )}
      {graded && (
        <Need missing={showMissing && needsCert && !value.cert_number.trim()} className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-cert`}>Certification number{needsCert && <Req />}</Label>
          <Input id={`${idPrefix}-cert`} placeholder="From the slab label" value={value.cert_number} onChange={(e) => onChange({ cert_number: e.target.value })} />
          {missingCert && <p className="text-xs text-red-700 font-medium">Slab removal needs the grading company and certification number.</p>}
        </Need>
      )}
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-defects`}>Known defects</Label>
        <Textarea
          id={`${idPrefix}-defects`}
          rows={2}
          placeholder="Creases, dents, whitening, stains, prior repairs or treatment, anything you know about"
          value={value.known_defects}
          onChange={(e) => onChange({ known_defects: e.target.value })}
        />
      </div>
    </div>
  );
}
