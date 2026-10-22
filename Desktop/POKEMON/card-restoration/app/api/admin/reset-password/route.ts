import { z } from "zod";
import { finishPasswordReset } from "@/lib/admin-password";

const Body = z.object({ token: z.string().max(100), password: z.string().max(200) });

// The reset link's form: sets the new password and signs that person out
// everywhere. They sign in again with the new password.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const error = await finishPasswordReset(parsed.data.token, parsed.data.password);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ ok: true });
}
