import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderLabel } from "@/lib/card-inquiries";
import { saveProblemReport } from "@/lib/problem-reports";

const Body = z.object({
  email: z.string().email(),
  description: z.string().trim().min(10).max(5000),
  photo_urls: z.array(z.string().url()).max(8).optional().default([]),
});

/**
 * Report a problem with a restoration order (R1234) or a kit order (K12),
 * from its order page. The email must match the order, as on the page.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the problem in a sentence or two (and check your email)." }, { status: 400 });
  const { email, description, photo_urls } = parsed.data;
  const raw = decodeURIComponent((await params).orderNumber).trim().toUpperCase();
  const admin = createAdminClient();

  const kit = /^K\d+$/.test(raw);
  const number = raw.replace(/^(K|R|CD-?)/, "");
  const fields = "order_number, customer_name, customer_email, customer_phone";
  let order: { order_number: string | number; customer_name: string | null; customer_email: string; customer_phone: string | null } | null = null;
  if (kit) {
    order = (await admin.from("shop_orders").select(fields).eq("order_number", Number(number)).maybeSingle()).data;
  } else {
    // Restoration order numbers are stored as "1234" (older ones as "CD-1209")
    for (const candidate of [...new Set([raw, number, `CD-${number}`])]) {
      order = (await admin.from("orders").select(fields).eq("order_number", candidate).maybeSingle()).data;
      if (order) break;
    }
  }
  if (!order || (order.customer_email ?? "").trim().toLowerCase() !== email.trim().toLowerCase()) {
    return Response.json({ error: "That order number and email don't match." }, { status: 404 });
  }
  const label = kit ? `K${order.order_number}` : orderLabel(order.order_number);
  const error = await saveProblemReport(admin, {
    orderRef: kit ? `K${order.order_number}` : String(order.order_number),
    orderLabel: label,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    description,
    photoUrls: photo_urls,
  });
  return error ? Response.json({ error }, { status: 500 }) : Response.json({ ok: true });
}
