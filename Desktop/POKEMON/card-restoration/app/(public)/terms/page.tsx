import type { Metadata } from "next";
import { TermsView } from "@/components/legal/terms-view";
import { TERMS_BLOCKS, TERMS_EFFECTIVE_LABEL, TERMS_VERSION } from "@/lib/legal/current-terms";

export const metadata: Metadata = {
  title: "Terms of Service | The Card Doc",
  description: "The Card Doc LLC Terms of Service, Restoration Consent & Online Store Agreement.",
};

/** The Terms in effect for new orders (legal/terms-v<version>.md). */
export default function TermsPage() {
  return (
    <TermsView
      version={TERMS_VERSION}
      effectiveLabel={TERMS_EFFECTIVE_LABEL}
      blocks={TERMS_BLOCKS}
      otherVersions={[{ version: "0.9", label: "Version 0.9 (in effect before v1.0)" }]}
    />
  );
}
