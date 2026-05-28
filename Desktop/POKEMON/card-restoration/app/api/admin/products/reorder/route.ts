import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { orderedIds } = await request.json() as { orderedIds: string[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();

  const updates = orderedIds.map((id, index) =>
    admin.from("products").update({ display_order: index }).eq("id", id)
  );

  await Promise.all(updates);

  return Response.json({ ok: true });
}
