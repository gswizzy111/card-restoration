import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // Read current value
  const { data: card, error: fetchErr } = await admin
    .from("cards")
    .select("completed")
    .eq("id", id)
    .single();

  if (fetchErr || !card) {
    console.error("[card complete] fetch error:", fetchErr);
    return Response.json({ error: fetchErr?.message ?? "Card not found" }, { status: fetchErr ? 500 : 404 });
  }

  const newState = !card.completed;

  // Update and read back the actual persisted value
  const { data: updated, error: updateErr } = await admin
    .from("cards")
    .update({ completed: newState })
    .eq("id", id)
    .select("completed")
    .single();

  if (updateErr || !updated) {
    console.error("[card complete] update error:", updateErr);
    return Response.json({ error: updateErr?.message ?? "Update failed" }, { status: 500 });
  }

  return Response.json({ completed: updated.completed });
}
