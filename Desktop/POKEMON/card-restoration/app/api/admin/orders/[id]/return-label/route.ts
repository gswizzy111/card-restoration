import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { shippo, businessAddress } from "@/lib/shippo";
import { resend, fromEmail, businessName } from "@/lib/resend";

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

async function getOrder(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("*").eq("id", id).single();
  return data;
}

async function getCards(orderId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cards")
    .select("card_name, estimated_value_cents")
    .eq("order_id", orderId);
  return data ?? [];
}

function buildAddressTo(order: Record<string, unknown>, addr: Record<string, string>) {
  return {
    name: (order.customer_name as string) ?? "",
    street1: addr.street1,
    street2: addr.street2 ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    zip: addr.zip ?? "",
    country: addr.country ?? "US",
    phone: (order.customer_phone as string) ?? "",
    email: (order.customer_email as string) ?? "",
  };
}

async function buildCustomsDeclaration(orderId: string) {
  const cards = await getCards(orderId);

  // Sum customer-declared card values; fall back to $50/card if none set
  const totalValueCents = cards.reduce(
    (sum, c) => sum + (c.estimated_value_cents ?? 5000),
    0
  );
  const totalValue = Math.max(totalValueCents / 100, 10); // minimum $10
  const cardCount = Math.max(cards.length, 1);

  // Build one customs item per card so the declaration is detailed
  const items = cards.length > 0
    ? cards.map((c) => ({
        description: c.card_name.slice(0, 25),
        quantity: 1,
        netWeight: "0.1",
        massUnit: "oz",
        valueAmount: ((c.estimated_value_cents ?? 5000) / 100).toFixed(2),
        valueCurrency: "USD",
        originCountry: "US",
      }))
    : [{
        description: "Returned trading cards",
        quantity: cardCount,
        netWeight: "8",
        massUnit: "oz",
        valueAmount: totalValue.toFixed(2),
        valueCurrency: "USD",
        originCountry: "US",
      }];

  return {
    contentsType: "RETURN_MERCHANDISE",
    contentsExplanation: "Returned goods",
    nonDeliveryOption: "RETURN",
    certify: true,
    certifySigner: process.env.BUSINESS_SHIPPING_NAME ?? businessAddress.name ?? "TCD",
    eelPfc: "NOEEI_30_37_a",
    items,
  };
}

const PARCEL = {
  massUnit: "lb" as const,
  weight: "1",
  distanceUnit: "in" as const,
  length: "7",
  width: "5",
  height: "1",
};

// GET — return rates without purchasing
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await getOrder(id);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    if (order.return_label_url) return Response.json({ labelUrl: order.return_label_url });

    const addr = order.ship_from_address as Record<string, string> | null;
    if (!addr?.street1) return Response.json({ error: "No customer address on file" }, { status: 400 });

    const isInternational = addr.country && addr.country !== "US";
    const customsDeclaration = isInternational ? await buildCustomsDeclaration(id) : undefined;

    const shipment = await shippo.shipments.create({
      addressFrom: businessAddress,
      addressTo: buildAddressTo(order, addr),
      parcels: [PARCEL],
      ...(customsDeclaration ? { customsDeclaration } : {}),
      async: false,
    } as any);

    const rates = [...(shipment.rates ?? [])]
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
      .slice(0, 5)
      .map((r) => ({
        objectId: r.objectId,
        provider: r.provider,
        service: r.servicelevel?.name ?? "",
        amount: r.amount,
        currency: r.currency,
        days: r.estimatedDays ?? null,
      }));

    if (rates.length === 0) return Response.json({ error: "No rates available from Shippo" }, { status: 500 });

    return Response.json({ rates, isInternational: !!isInternational });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[restoration return-label GET]", msg);
    return Response.json({ error: `Failed to get rates: ${msg}` }, { status: 500 });
  }
}

// POST — purchase the chosen rate
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await getOrder(id);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    if (order.return_label_url) return Response.json({ labelUrl: order.return_label_url });

    const body = await req.json().catch(() => ({}));
    const { rateObjectId, insuranceDeclaredValueCents: adminInsuranceCents } = body;
    if (!rateObjectId) return Response.json({ error: "Missing rateObjectId" }, { status: 400 });

    const addr = order.ship_from_address as Record<string, string> | null;
    const isInternational = addr?.country && addr.country !== "US";

    // Admin-supplied insurance takes priority; fall back to customer's round-trip insurance
    const insuranceCents: number =
      (typeof adminInsuranceCents === "number" && adminInsuranceCents > 0)
        ? adminInsuranceCents
        : (order.insurance_type === "round_trip" && (order.insurance_declared_value_cents ?? 0) > 0)
          ? (order.insurance_declared_value_cents as number)
          : 0;
    const hasInsurance = insuranceCents > 0;
    const hasRoundTripInsurance = hasInsurance; // keep legacy var name for the payload below

    // International: create a fresh shipment+transaction so customs is attached to the label
    // (Shippo requires customs on the shipment, not just the rate)
    let labelUrl: string;
    let trackingNumber: string | null;
    let trackingUrl: string | null;

    if (isInternational && addr) {
      const customsDeclaration = await buildCustomsDeclaration(id);

      const shipment = await shippo.shipments.create({
        addressFrom: businessAddress,
        addressTo: buildAddressTo(order, addr),
        parcels: [PARCEL],
        customsDeclaration,
        async: false,
      } as any);

      const rates = (shipment.rates ?? []).sort(
        (a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount)
      );

      // Find the rate matching the one the admin selected (by provider+service),
      // falling back to the cheapest if the exact rate expired
      const selectedRateObj = rates.find((r: any) => r.objectId === rateObjectId) ?? rates[0];
      if (!selectedRateObj) {
        return Response.json({ error: "No shipping rates available for this address" }, { status: 422 });
      }

      const txRes = await fetch("https://api.goshippo.com/transactions/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rate: selectedRateObj.objectId, label_file_type: "PDF_4x6", async: false }),
      });
      const transaction = await txRes.json() as Record<string, unknown>;
      if (transaction.status !== "SUCCESS" || !transaction.label_url) {
        const messages = (transaction.messages as {text:string}[] | undefined) ?? [];
        const detail = messages.map((m) => m.text).join("; ") || JSON.stringify(transaction);
        return Response.json({ error: `Label purchase failed: ${detail}` }, { status: 500 });
      }

      labelUrl = transaction.label_url as string;
      trackingNumber = (transaction.tracking_number as string) ?? null;
      trackingUrl = (transaction.tracking_url_provider as string) ?? null;
    } else {
      // Domestic — use direct REST API so `extra` (insurance, signature) isn't stripped by the SDK
      const txBody: Record<string, unknown> = {
        rate: rateObjectId,
        label_file_type: "PDF_4x6",
        async: false,
      };
      if (hasRoundTripInsurance) {
        txBody.extra = {
          insurance: {
            amount: (insuranceCents / 100).toFixed(2),
            currency: "USD",
            provider: "SHIPPO",
            content: "Trading cards",
          },
        };
      }
      const txRes = await fetch("https://api.goshippo.com/transactions/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${process.env.SHIPPO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(txBody),
      });
      const transaction = await txRes.json() as Record<string, unknown>;
      if (transaction.status !== "SUCCESS" || !transaction.label_url) {
        const messages = (transaction.messages as {text:string}[] | undefined) ?? [];
        const detail = messages.map((m) => m.text).join("; ") || JSON.stringify(transaction);
        return Response.json({ error: `Label purchase failed: ${detail}` }, { status: 500 });
      }

      labelUrl = transaction.label_url as string;
      trackingNumber = (transaction.tracking_number as string) ?? null;
      trackingUrl = (transaction.tracking_url_provider as string) ?? null;
    }

    const admin = createAdminClient();
    await admin
      .from("orders")
      .update({
        return_label_url: labelUrl,
        tracking_number: trackingNumber ?? null,
        status: "shipped_back",
      })
      .eq("id", id);

    await admin.from("order_events").insert({
      order_id: id,
      event_type: "status_updated",
      description: trackingNumber
        ? `Return label purchased — marked Shipped Back. Tracking: ${trackingNumber}`
        : "Return label purchased — marked Shipped Back.",
      is_customer_visible: true,
    });

    if (order.customer_email && trackingNumber) {
      const firstName = (order.customer_name as string)?.split(" ")[0] ?? "there";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://thecarddoc1.com";
      const orderTrackingUrl = `${appUrl}/orders/${order.order_number}`;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: order.customer_email as string,
          subject: `Your restored cards are on the way! — ${businessName}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
              <h1 style="font-size:22px;font-weight:900;margin-bottom:4px">Your cards have been shipped!</h1>
              <p>Hi ${firstName}, your restored cards are on their way back to you.</p>

              <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:20px;margin:20px 0">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#0891b2">Tracking Number</p>
                <p style="margin:0 0 10px;font-family:monospace;font-size:22px;font-weight:900;color:#0e7490;letter-spacing:0.05em">${trackingNumber}</p>
                ${trackingUrl
                  ? `<a href="${trackingUrl}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Track Your Package →</a>`
                  : ""}
              </div>

              <a href="${orderTrackingUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:24px">View Your Order →</a>

              <p style="font-size:14px;color:#666;">If you have any questions, reply to this email or reach out at <a href="mailto:${fromEmail}" style="color:#c0392b">${fromEmail}</a>.</p>
              <p style="font-size:13px;color:#999">${businessName}</p>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send shipping email:", err);
      }
    }

    return Response.json({ labelUrl, trackingNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[restoration return-label POST]", msg);
    return Response.json({ error: `Failed to purchase label: ${msg}` }, { status: 500 });
  }
}
