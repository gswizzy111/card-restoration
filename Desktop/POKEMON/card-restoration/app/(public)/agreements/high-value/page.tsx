import type { Metadata } from "next";
import { AgreementPage } from "@/components/legal/agreement-page";
import { highValueAgreement } from "@/lib/agreements";

export const metadata: Metadata = {
  title: "High-Value Card Agreement | The Card Doc",
  description: "The agreement you sign at checkout for each card with a declared value above $5,000.",
};

export default function HighValueAgreementPage() {
  return <AgreementPage agreement={highValueAgreement(null)} when="Signed at checkout for every card with a declared value above $5,000, one card at a time." />;
}
