import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { createAdminClient } from "@/lib/supabase/admin";
import { agreementByToken, loadAgreementContext } from "@/lib/high-value";
import { HighValueSignForm } from "./sign-form";

export const metadata: Metadata = { title: "Sign your High-Value Agreement | The Card Doc", robots: { index: false } };

/** The customer's signing page for one card's High-Value Agreement, from the emailed link. */
export default async function SignHighValuePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const agreement = await agreementByToken(admin, token);
  const ctx = agreement ? await loadAgreementContext(admin, agreement) : null;

  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        {!agreement || !ctx ? (
          <>
            <h1 className="font-heading text-4xl font-bold text-foreground mb-2">Link not valid</h1>
            <p className="text-muted-foreground mb-8">This signing link isn&apos;t valid anymore. It may have been replaced by a newer one, or the agreement was already signed.</p>
            <p className="text-sm text-muted-foreground">Email <a href="mailto:thecarddoc1@gmail.com" className="font-semibold text-primary underline">thecarddoc1@gmail.com</a> and we&apos;ll send a new link.</p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-4xl font-bold text-foreground mb-2">{ctx.doc.title}</h1>
            <p className="text-muted-foreground mb-8">Your card stays on hold until you and The Card Doc have both signed. Read it in full, then sign below.</p>
            <div className="rounded-xl border border-border p-6 md:p-8">
              <LegalDocument blocks={ctx.doc.blocks} />
            </div>
            <div className="mt-8">
              {agreement.customer_signature_id ? (
                <p className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                  Signed. We&apos;ll countersign and email you the fully signed copy.
                </p>
              ) : agreement.status !== "pending" ? (
                <p className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">This agreement is no longer open for signature.</p>
              ) : (
                <HighValueSignForm token={token} />
              )}
            </div>
            <p className="mt-10 text-sm text-muted-foreground">
              This agreement is in addition to our <Link href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
