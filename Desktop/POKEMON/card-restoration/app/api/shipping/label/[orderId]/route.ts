import { workingLabelUrl } from "@/lib/label-link";

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
  return Response.redirect(url, 302);
}
