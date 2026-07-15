import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { getSubscriptionPriceCents } from "@/lib/store-config";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone is required"),
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP is required"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const message = issues[0]?.message ?? "Invalid input";
    return Response.json({ error: message }, { status: 422 });
  }

  const { name, email, phone, street1, street2, city, state, zip } = parsed.data;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
  const priceCents = await getSubscriptionPriceCents();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Monthly Kit Club — The Card Doc" },
            unit_amount: priceCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/subscribe/success`,
      cancel_url: `${appUrl}/subscribe`,
      metadata: {
        type: "subscription",
        customer_name: name,
        customer_phone: phone,
        shipping_address_json: JSON.stringify({
          street1,
          street2: street2 ?? null,
          city,
          state,
          zip,
          country: "US",
        }),
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Stripe subscription checkout error:", err);
    return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
