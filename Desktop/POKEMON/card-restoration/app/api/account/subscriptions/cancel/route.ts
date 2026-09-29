import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, status")
    .ilike("customer_email", user.email!)
    .eq("status", "active")
    .maybeSingle();

  if (!sub) return Response.json({ error: "No active subscription found." }, { status: 404 });

  try {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to cancel with payment provider.";
    return Response.json({ error: msg }, { status: 500 });
  }

  await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", sub.id);

  return Response.json({ ok: true });
}
