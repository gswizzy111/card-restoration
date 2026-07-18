import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const CreateSchema = z.object({
  type: z.enum(["internal", "support"]),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  customer_name: z.string().optional().default(""),
  customer_email: z.string().optional().default(""),
  customer_phone: z.string().optional().default(""),
  order_ref: z.string().optional().default(""),
});

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("cases").select("*").order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid data" }, { status: 400 });

  const d = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.from("cases").insert({
    type: d.type,
    title: d.title,
    description: d.description || null,
    priority: d.priority,
    status: "open",
    customer_name: d.customer_name || null,
    customer_email: d.customer_email || null,
    customer_phone: d.customer_phone || null,
    order_ref: d.order_ref || null,
  }).select("id").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ id: data.id });
}
