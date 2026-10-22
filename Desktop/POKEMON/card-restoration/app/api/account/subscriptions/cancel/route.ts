import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { sendCancellationEmail } from "@/lib/subscription-emails";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, status, customer_email, customer_name")
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

  const cancelledAt = new Date();
  await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: cancelledAt.toISOString() })
    .eq("id", sub.id);
  await sendCancellationEmail(sub.customer_email, sub.customer_name, cancelledAt);

  return Response.json({ ok: true });
}
