import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { refundCard } from "@/lib/refunds";

const Body = z.object({ sendEmail: z.boolean().optional() });

/**
 * Refund one card's service fee while work on it hasn't started (Terms
 * Section 11); lib/refunds.ts does the refund.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (session?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const result = await refundCard(createAdminClient(), id, parsed.data, session.username);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true, amountCents: result.amountCents });
}
