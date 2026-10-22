import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-auth";

const Body = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  discount_percent: z.number().int().min(0).max(100).optional(),
});

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

  const { error } = await admin.from("affiliates").update(update).eq("id", id);
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

  return Response.json({ ok: true });
}
