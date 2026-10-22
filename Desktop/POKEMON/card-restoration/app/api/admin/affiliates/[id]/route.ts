import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";

const Body = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  discount_percent: z.number().int().min(0).max(100).optional(),
  // A new commission rate for this code, for sales from now on or for every sale
  commission_percent: z.number().min(0).max(100).optional(),
  commission_scope: z.enum(["future", "all"]).optional(),
});

// A rate that starts before any sale, so it covers all of them
const EVERY_SALE = "2000-01-01T00:00:00Z";

// Escape LIKE wildcards so a code is matched literally (case-insensitive)
function literal(code: string) {
  return code.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Enter a name, a code, and a discount between 0 and 100." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current } = await admin.from("affiliates").select("id, code").eq("id", id).single();
  if (!current) return Response.json({ error: "Code not found." }, { status: 404 });

  const update: Record<string, string | number> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.code !== undefined) update.code = parsed.data.code.toUpperCase();
  if (parsed.data.discount_percent !== undefined) update.discount_percent = parsed.data.discount_percent;

  const { error } = Object.keys(update).length
    ? await admin.from("affiliates").update(update).eq("id", id)
    : { error: null };
  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That code is already taken." }, { status: 409 });
    }
    console.error("Update affiliate error:", error);
    return Response.json({ error: "Failed to update code." }, { status: 500 });
  }

  // Sales are linked by code, so a renamed code takes its past sales with it
  const newCode = update.code as string | undefined;
  if (newCode && newCode !== current.code) {
    const oldCode = literal(current.code);
    await Promise.all([
      admin.from("orders").update({ affiliate_code: newCode }).ilike("affiliate_code", oldCode),
      admin.from("shop_orders").update({ affiliate_code: newCode }).ilike("affiliate_code", oldCode),
    ]);
  }

  if (parsed.data.commission_percent !== undefined) {
    const percent = Math.round(parsed.data.commission_percent * 100) / 100;
    if (parsed.data.commission_scope === "all") {
      // One rate for every sale this code has ever made
      await admin.from("affiliate_commission_rates").delete().eq("affiliate_id", id);
      await admin.from("affiliate_commission_rates").insert({ affiliate_id: id, percent, effective_from: EVERY_SALE });
    } else {
      await admin.from("affiliate_commission_rates").insert({ affiliate_id: id, percent, effective_from: new Date().toISOString() });
    }
  }

  return Response.json({ ok: true });
}
