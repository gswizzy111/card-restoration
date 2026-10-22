import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const admin = createAdminClient();
  const { error } = await admin.from("products").update(body).eq("id", id);
  if (error) {
    console.error("Product update error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
