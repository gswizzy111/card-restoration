import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { code } = body;

  if (!code || typeof code !== "string") {
    return Response.json({ error: "Code is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: affiliate, error } = await admin
    .from("affiliates")
    .select("id, name, code")
    .ilike("code", code.trim())
    .single();

  if (error || !affiliate) {
    return Response.json({ error: "Invalid creator code." }, { status: 404 });
  }

  const jar = await cookies();
  jar.set("affiliate_session", affiliate.id, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return Response.json({ ok: true });
}
