import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { kits_allocated } = await request.json();
  if (typeof kits_allocated !== "number" || kits_allocated < 0) {
    return Response.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("partners").update({ kits_allocated }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
