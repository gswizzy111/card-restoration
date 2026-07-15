import { getSubscriptionPriceCents } from "@/lib/store-config";
import { SubscribeForm } from "./subscribe-form";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const priceCents = await getSubscriptionPriceCents();
  return <SubscribeForm priceCents={priceCents} />;
}
