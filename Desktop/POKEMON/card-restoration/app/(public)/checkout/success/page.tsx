import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let order: { order_number: string; customer_email: string; inbound_label_url: string | null } | null = null;

  if (session_id) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("order_number, customer_email, inbound_label_url")
      .eq("stripe_session_id", session_id)
      .single();
    order = data;
  }

  return (
    <section className="flex-1 flex items-center justify-center py-24 px-6">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-accent" />

        <div>
          <h1 className="font-serif text-4xl font-medium text-foreground mb-2">
            Order confirmed.
          </h1>
          {order?.order_number && (
            <p className="text-2xl font-serif text-accent font-medium">
              {order.order_number}
            </p>
          )}
        </div>

        <p className="text-muted-foreground">
          We&apos;ve sent a confirmation to{" "}
          {order?.customer_email ? (
            <strong>{order.customer_email}</strong>
          ) : (
            "your email"
          )}{" "}
          with everything you need.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {order?.inbound_label_url && (
            <a
              href={order.inbound_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Download Shipping Label
            </a>
          )}
          {order?.order_number && (
            <Button
              className="flex-1"
              render={<Link href={`/orders/${order.order_number}?email=${encodeURIComponent(order.customer_email)}`} />}
            >
              View Order Status
            </Button>
          )}
        </div>

        <div className="w-full border border-border rounded-lg p-6 text-left">
          <p className="text-sm font-medium text-foreground mb-3">What happens next</p>
          <ol className="flex flex-col gap-2">
            {[
              "Ship your cards using the label (or your own carrier)",
              "We receive and inspect your cards — you'll get an email",
              "We restore and ship back with tracking",
            ].map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                <span className="font-serif text-accent font-medium">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
