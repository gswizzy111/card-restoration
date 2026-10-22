import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdminClient();
  const { error } = await admin.from("products").insert(body);
  if (error) {
    console.error("Product insert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
