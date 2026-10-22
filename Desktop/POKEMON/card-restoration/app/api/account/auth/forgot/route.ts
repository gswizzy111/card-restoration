import { sendResetLink } from "@/lib/account-reset";
import { z } from "zod";

const Body = z.object({ email: z.string().email() });

// Emails a reset link when the account exists. Always answers the same way,
// so the form can't be used to find out who has an account.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  await sendResetLink(parsed.data.email.trim().toLowerCase());
  return Response.json({ ok: true });
}
