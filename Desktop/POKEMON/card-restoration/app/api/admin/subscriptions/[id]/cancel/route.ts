import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin-auth";
import { sendCancellationEmail } from "@/lib/subscription-emails";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status, customer_email, customer_name")
    .eq("id", id)
    .single();

  if (error || !sub) return Response.json({ error: "Subscription not found" }, { status: 404 });
  if (sub.status === "cancelled") return Response.json({ error: "Already cancelled" }, { status: 400 });

  try {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const cancelledAt = new Date();
  await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: cancelledAt.toISOString() })
    .eq("id", id);
  await sendCancellationEmail(sub.customer_email, sub.customer_name, cancelledAt);

  return Response.json({ ok: true });
}
