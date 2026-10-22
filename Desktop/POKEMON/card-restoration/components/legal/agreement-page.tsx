import Link from "next/link";
import type { AgreementDoc } from "@/lib/legal/agreements-v1";
import { LegalDocument } from "./legal-document";

/** A card-specific agreement's public page: the wording customers sign, as a template. */
export function AgreementPage({ doc, when, footnote }: { doc: AgreementDoc; when: string; footnote: string }) {
  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">{doc.title}</h1>
        <p className="text-muted-foreground mb-8">{when}</p>
        <div className="rounded-xl border border-border p-6 md:p-8">
          <LegalDocument blocks={doc.blocks} />
          <p className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">{footnote}</p>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          This sits alongside our <Link href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
