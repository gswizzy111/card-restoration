import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdminAuth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(request: Request) {
  if (!(await checkAdminAuth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, code, discount_percent } = body;

  if (!name || typeof name !== "string" || !code || typeof code !== "string") {
    return Response.json({ error: "Name and code are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("affiliates").insert({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    discount_percent: typeof discount_percent === "number" ? discount_percent : 0,
  });

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That code is already taken." }, { status: 409 });
    }
    console.error("Insert affiliate error:", error);
    return Response.json({ error: "Failed to create affiliate." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function GET() {
  if (!(await checkAdminAuth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: affiliates, error } = await admin
    .from("affiliates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to fetch affiliates." }, { status: 500 });
  }

  return Response.json({ affiliates });
}
