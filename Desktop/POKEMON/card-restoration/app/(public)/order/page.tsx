import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrderBuilder } from "@/components/order-builder/builder";

export default async function OrderPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, short_description, full_description, price_cents, turnaround_days, display_order, active")
    .eq("active", true)
    .order("display_order");

  return (
    <Suspense>
      <OrderBuilder services={services ?? []} />
    </Suspense>
  );
}
