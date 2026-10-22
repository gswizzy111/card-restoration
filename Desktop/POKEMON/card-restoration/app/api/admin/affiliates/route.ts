import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/commission";

async function checkAdminAuth() {
  return isAdmin();
}

export async function POST(request: Request) {
  if (!(await checkAdminAuth())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, code, discount_percent, commission_percent } = body;

  if (!name || typeof name !== "string" || !code || typeof code !== "string") {
    return Response.json({ error: "Name and code are required." }, { status: 400 });
  }

  const commission = typeof commission_percent === "number" ? commission_percent : DEFAULT_COMMISSION_PERCENT;
  if (!(commission >= 0 && commission <= 100)) {
    return Response.json({ error: "Commission must be between 0 and 100." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin.from("affiliates").insert({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    discount_percent: typeof discount_percent === "number" ? discount_percent : 0,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That code is already taken." }, { status: 409 });
    }
    console.error("Insert affiliate error:", error);
    return Response.json({ error: "Failed to create affiliate." }, { status: 500 });
  }
  if (commission !== DEFAULT_COMMISSION_PERCENT) {
    await admin.from("affiliate_commission_rates").insert({ affiliate_id: created.id, percent: commission, effective_from: "2000-01-01T00:00:00Z" });
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
    .select("id, name, code, discount_percent, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to fetch affiliates." }, { status: 500 });
  }

  return Response.json({ affiliates });
}
