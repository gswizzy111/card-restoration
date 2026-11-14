import { workingLabelUrl, labelExpired } from "@/lib/label-link";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The permanent link to an order's prepaid label (lib/label-link.ts). The
// order id is unguessable, the same as the Shippo link it stands in for.
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!UUID.test(orderId)) return new Response("Label not found", { status: 404 });

  const url = await workingLabelUrl(orderId).catch((e) => {
    console.error("[label link]", orderId, e);
    return null;
  });
  if (!url) {
    return new Response(
      "We couldn't find a shipping label for this order. Please reply to your order email and we'll send a new one.",
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  if (labelExpired(url)) {
    // Shippo wouldn't re-sign this label: say so instead of sending the
    // customer to Shippo's "Access denied" page
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shipping label expired</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#111;line-height:1.6">
<h1 style="font-size:22px">This shipping label has expired</h1>
<p>The download link for your prepaid label is no longer valid, so please don't ship with it. Reply to your order confirmation email and we'll send you a new label right away.</p>
</body></html>`,
      { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  return Response.redirect(url, 302);
}
