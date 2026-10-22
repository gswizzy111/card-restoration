import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { sendCancellationEmail } from "@/lib/subscription-emails";

const Schema = z.object({
  email: z.string().email(),
  subscriptionId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { email, subscriptionId } = parsed.data;
  const admin = createAdminClient();

  // Verify the subscription belongs to this email
  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("id, stripe_subscription_id, status, customer_email, customer_name")
    .eq("id", subscriptionId)
    .single();

  if (error || !sub) return Response.json({ error: "Subscription not found" }, { status: 404 });
  if (sub.customer_email.toLowerCase() !== email.toLowerCase()) {
    return Response.json({ error: "Email does not match" }, { status: 403 });
  }
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
    .eq("id", subscriptionId);
  await sendCancellationEmail(sub.customer_email, sub.customer_name, cancelledAt);

  return Response.json({ ok: true });
}
