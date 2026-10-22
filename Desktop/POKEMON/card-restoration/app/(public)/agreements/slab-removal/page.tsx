import type { Metadata } from "next";
import { AgreementPage } from "@/components/legal/agreement-page";
import { slabAuthorization, SLAB_TITLE, TEMPLATE_CARD } from "@/lib/legal/agreements-v1";

export const metadata: Metadata = {
  title: `${SLAB_TITLE} | The Card Doc`,
  description: "The card-specific authorization you sign at checkout before we open a graded holder.",
};

export default function SlabRemovalAgreementPage() {
  return (
    <AgreementPage
      doc={slabAuthorization(TEMPLATE_CARD)}
      when="Signed at checkout for each slabbed card you want opened, one card at a time."
      footnote="Signed with your typed full name. The date and time come from our server when you place the order, and you get a signed PDF by email."
    />
  );
}
