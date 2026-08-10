import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
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

  await admin
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);

  return Response.json({ ok: true });
}
