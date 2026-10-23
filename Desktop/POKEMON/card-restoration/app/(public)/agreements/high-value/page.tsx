import type { Metadata } from "next";
import { AgreementPage } from "@/components/legal/agreement-page";
import { highValueAgreementDoc, HIGH_VALUE_TITLE, TEMPLATE_CARD } from "@/lib/legal/agreements-v1";

export const metadata: Metadata = {
  title: `${HIGH_VALUE_TITLE} | The Card Doc`,
  description: "The agreement each card valued above $5,000 needs, signed by you and by us, before any work starts.",
};

export default function HighValueAgreementPage() {
  return (
    <AgreementPage
      doc={highValueAgreementDoc({ ...TEMPLATE_CARD, grading_company: "[grading company]", grade: "[grade]", cert_number: "[cert number]", declared_value_cents: null }, { orderNumber: "[order number]", customerName: "[your name]" }, "[Anything we agree for this card, such as shipping, insurance or liability, is written here.]")}
      when="Required for every card valued above $5,000. We email it after you order; the card stays on hold until you and we have both signed."
      footnote="You sign with your typed full name from the link we email you; then we countersign. Both signatures are dated by our server, and you get the signed PDF by email."
    />
  );
}
