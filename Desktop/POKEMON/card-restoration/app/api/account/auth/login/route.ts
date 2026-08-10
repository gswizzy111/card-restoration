import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
