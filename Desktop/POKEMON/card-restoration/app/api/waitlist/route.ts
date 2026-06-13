import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("waitlist")
    .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" });

  if (error) return Response.json({ error: "Failed to save. Please try again." }, { status: 500 });

  return Response.json({ ok: true });
}
