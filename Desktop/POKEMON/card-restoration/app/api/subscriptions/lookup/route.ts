import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") ?? "").toLowerCase().trim();
  if (!email) return Response.json({ error: "Email required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, status, created_at, cancelled_at")
    .eq("customer_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return Response.json({ found: false });

  return Response.json({
    found: true,
    id: data.id,
    status: data.status,
    created_at: data.created_at,
    cancelled_at: data.cancelled_at,
  });
}
