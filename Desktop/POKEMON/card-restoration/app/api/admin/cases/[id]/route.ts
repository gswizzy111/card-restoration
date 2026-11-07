import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { getAdminRole, isAdmin } from "@/lib/admin-auth";

const PatchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

async function requireAdmin() {
  return isAdmin();
}

// Status and priority: admins and support staff (customer cases only).
// Deleting a case stays with admins.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getAdminRole();
  if (role !== "admin" && role !== "support") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const admin = createAdminClient();
  let update = admin.from("cases").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id);
  if (role === "support") update = update.neq("type", "internal");
  const { data, error } = await update.select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.length) return Response.json({ error: "Case not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("cases").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
