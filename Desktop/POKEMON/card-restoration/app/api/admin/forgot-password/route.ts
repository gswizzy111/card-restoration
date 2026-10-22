import { z } from "zod";
import { startPasswordReset } from "@/lib/admin-password";

const Body = z.object({ login: z.string().trim().min(1).max(320) });

// Emails a reset link when the username or email has one on file. Always
// answers the same way, so the form can't be used to find out who has access.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Enter your username or email." }, { status: 400 });
  await startPasswordReset(parsed.data.login);
  return Response.json({ ok: true });
}
