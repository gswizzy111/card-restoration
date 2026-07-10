import { z } from "zod";
import { stripe } from "@/lib/stripe";

const Schema = z.object({
  amount_cents: z.number().int().min(1000).max(100000),
  purchaser_name: z.string().min(1),
  purchaser_email: z.string().email(),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email(),
  personal_message: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const data = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const amountDollars = (data.amount_cents / 100).toFixed(2);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: data.purchaser_email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `The Card Doc Gift Card — $${amountDollars}`,
            description: "Redeemable on any card restoration order at thecarddoc1.com",
          },
          unit_amount: data.amount_cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/gift-cards/success`,
    cancel_url: `${appUrl}/gift-cards`,
    metadata: {
      type: "gift_card",
      amount_cents: String(data.amount_cents),
      purchaser_name: data.purchaser_name,
      purchaser_email: data.purchaser_email,
      recipient_name: data.recipient_name,
      recipient_email: data.recipient_email,
      personal_message: data.personal_message ?? "",
    },
  });

  return Response.json({ url: session.url });
}
