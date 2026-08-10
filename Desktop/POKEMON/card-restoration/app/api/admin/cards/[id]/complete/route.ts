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

  const { data: card } = await admin.from("cards").select("completed").eq("id", id).single();
  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const newState = !card.completed;
  await admin.from("cards").update({ completed: newState }).eq("id", id);

  return Response.json({ completed: newState });
}
