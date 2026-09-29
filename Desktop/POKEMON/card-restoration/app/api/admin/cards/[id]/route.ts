import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const admin = createAdminClient();

  // Read current card first — we snapshot original_data on first edit
  const { data: current } = await admin.from("cards").select("*").eq("id", id).single();
  if (!current) return Response.json({ error: "Card not found" }, { status: 404 });

  const allowed = ["card_name", "card_set", "card_year", "estimated_value_cents", "notes", "photo_urls"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // First-time edit: freeze the customer's original values so we can show them permanently
  if (!(current as Record<string, unknown>).original_data) {
    update.original_data = {
      card_name: current.card_name,
      card_set: current.card_set ?? null,
      card_year: (current as Record<string, unknown>).card_year ?? null,
      estimated_value_cents: current.estimated_value_cents ?? null,
      notes: current.notes ?? null,
      photo_urls: (current.photo_urls as string[] | null) ?? [],
    };
  }

  const { error } = await admin.from("cards").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
