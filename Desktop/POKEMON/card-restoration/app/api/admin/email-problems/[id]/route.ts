import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  resolved: z.boolean(),
  // Mark fixed: the open rows the admin's card showed for this address, so a
  // problem that arrived after the page loaded stays open
  ids: z.array(z.string().uuid()).min(1).max(1000).optional(),
});

// The Email Problems page: "Mark fixed" settles the address's problems the
// admin saw; "Open again" reopens just that row.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("email_problems").select("id, email").eq("id", id).maybeSingle();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const resolvedAt = parsed.data.resolved ? new Date().toISOString() : null;
  const update = admin.from("email_problems").update({ resolved_at: resolvedAt });
  const { data, error } = await (parsed.data.resolved
    ? update.in("id", parsed.data.ids ?? [id]).eq("email", row.email).is("resolved_at", null)
    : update.eq("id", id)
  ).select("id");
  if (error) return Response.json({ error: "Could not update it. Please try again." }, { status: 500 });
  return Response.json({ ok: true, ids: (data ?? []).map((r) => r.id), resolved_at: resolvedAt });
}
