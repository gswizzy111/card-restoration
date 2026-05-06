import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let order: { order_number: string; customer_email: string } | null = null;

  if (session_id) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("order_number, customer_email")
      .eq("stripe_session_id", session_id)
      .single();
    order = data;
  }

  return (
    <section className="flex-1 flex items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-primary" />
        <div>
          <h1 className="font-heading font-black text-4xl text-foreground mb-2">Order Confirmed</h1>
          {order?.order_number && (
            <p className="text-muted-foreground text-sm">
              Order <span className="font-bold text-foreground">#{order.order_number}</span>
            </p>
          )}
        </div>
        <p className="text-muted-foreground">
          Thank you! We&apos;ll be in touch soon with next steps.
        </p>
        <div className="flex flex-col gap-3 w-full">
          {order?.order_number && (
            <Button
              render={<Link href={`/orders/${order.order_number}`} />}
              className="font-bold w-full"
            >
              Track Your Order
            </Button>
          )}
          <Button
            variant="outline"
            render={<Link href="/" />}
            className="font-bold w-full border-2"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </section>
  );
}
