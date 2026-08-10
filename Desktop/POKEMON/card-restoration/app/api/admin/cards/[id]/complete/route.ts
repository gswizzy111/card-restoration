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

  const { data: card, error: fetchErr } = await admin.from("cards").select("completed").eq("id", id).single();

  if (fetchErr) {
    // Column doesn't exist yet — return a no-op
    if (fetchErr.code === "42703" || fetchErr.message.includes("completed")) {
      return Response.json({ completed: false, migration_needed: true });
    }
    return Response.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const newState = !card.completed;
  const { error: updateErr } = await admin.from("cards").update({ completed: newState }).eq("id", id);
  if (updateErr && (updateErr.code === "42703" || updateErr.message.includes("completed"))) {
    return Response.json({ completed: false, migration_needed: true });
  }

  return Response.json({ completed: newState });
}
