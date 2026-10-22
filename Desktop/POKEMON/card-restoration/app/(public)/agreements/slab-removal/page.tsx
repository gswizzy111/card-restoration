import type { Metadata } from "next";
import { AgreementPage } from "@/components/legal/agreement-page";
import { slabRemovalAgreement } from "@/lib/agreements";

export const metadata: Metadata = {
  title: "Slab-Removal Authorization | The Card Doc",
  description: "The authorization you sign at checkout before we remove a card from its grading-company holder.",
};

export default function SlabRemovalAgreementPage() {
  return <AgreementPage agreement={slabRemovalAgreement(null)} when="Signed at checkout whenever your order includes slab cracking." />;
}
