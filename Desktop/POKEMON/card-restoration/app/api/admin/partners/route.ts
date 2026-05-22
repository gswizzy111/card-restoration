import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("partners").select("*").order("created_at", { ascending: false });
  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, store_name, passcode, kits_allocated } = await request.json();
  if (!name?.trim() || !passcode?.trim()) {
    return Response.json({ error: "Name and passcode are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("partners").insert({
    name: name.trim(),
    store_name: store_name?.trim() || null,
    passcode: passcode.trim(),
    kits_allocated: kits_allocated ?? 0,
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
