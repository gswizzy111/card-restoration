import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { agreementByToken, customerSignHighValue } from "@/lib/high-value";

const Body = z.object({ signer_name: z.string().trim().min(2).max(120), agreed: z.literal(true) });

/** The customer signs a High-Value Agreement from the link we emailed them. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the box and type your full legal name to sign." }, { status: 400 });
  const admin = createAdminClient();
  const agreement = await agreementByToken(admin, (await params).token);
  if (!agreement) return Response.json({ error: "This link isn't valid anymore. Ask us for a new one." }, { status: 404 });
  const error = await customerSignHighValue(admin, request, agreement, parsed.data.signer_name);
  if (error) return Response.json({ error }, { status: 409 });
  return Response.json({ ok: true });
}
