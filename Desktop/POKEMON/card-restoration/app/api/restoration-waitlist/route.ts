import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please fill in all required fields." }, { status: 400 });

  const { name, email, phone } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.from("restoration_waitlist").upsert(
    { name, email: email.toLowerCase().trim(), phone: phone?.trim() ?? null },
    { onConflict: "email" }
  );

  if (error) return Response.json({ error: "Failed to save. Please try again." }, { status: 500 });
  return Response.json({ ok: true });
}
