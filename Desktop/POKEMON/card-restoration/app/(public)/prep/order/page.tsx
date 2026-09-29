import { createAdminClient } from "@/lib/supabase/admin";
import { PrepOrderForm } from "./prep-order-form";

export const dynamic = "force-dynamic";

async function getPrepPrices() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_config")
      .select("key, value")
      .in("key", ["prep_standard_price_cents", "prep_pre_grade_price_cents", "prep_slab_crack_price_cents"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return {
      standardPriceCents: parseInt(map.prep_standard_price_cents ?? "2500", 10),
      preGradePriceCents: parseInt(map.prep_pre_grade_price_cents ?? "500", 10),
      slabCrackPriceCents: parseInt(map.prep_slab_crack_price_cents ?? "700", 10),
    };
  } catch {
    return { standardPriceCents: 2500, preGradePriceCents: 500, slabCrackPriceCents: 700 };
  }
}

export default async function PrepOrderPage() {
  const prices = await getPrepPrices();

  return (
    <PrepOrderForm
      standardPriceCents={prices.standardPriceCents}
      preGradePriceCents={prices.preGradePriceCents}
      slabCrackPriceCents={prices.slabCrackPriceCents}
    />
  );
}
