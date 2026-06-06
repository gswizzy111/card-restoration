import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { tracking_number } = await request.json();
  if (!tracking_number) return Response.json({ error: "Missing tracking_number" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ inbound_tracking_number: tracking_number })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
