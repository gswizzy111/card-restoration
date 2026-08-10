import { createAdminClient } from "@/lib/supabase/admin";

export async function getSubscriptionPriceCents(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_config")
      .select("value")
      .eq("key", "subscription_price_cents")
      .single();
    if (data?.value) return parseInt(data.value, 10);
  } catch {}
  return 6299;
}

export async function getRestorationsOpen(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_config")
      .select("value")
      .eq("key", "restorations_open")
      .single();
    if (data?.value === "false") return false;
  } catch {}
  return true;
}

export async function getSlotsOpenedAt(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_config")
      .select("value")
      .eq("key", "slots_opened_at")
      .single();
    return data?.value ?? null;
  } catch {}
  return null;
}
