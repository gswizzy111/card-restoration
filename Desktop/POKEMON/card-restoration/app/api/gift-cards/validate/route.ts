import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();

  if (!code) return Response.json({ ok: false, error: "No code provided." }, { status: 400 });

  const admin = createAdminClient();
  const { data: card } = await admin
    .from("gift_cards")
    .select("id, remaining_cents, status")
    .eq("code", code)
    .maybeSingle();

  if (!card) return Response.json({ ok: false, error: "Gift card not found." });
  if (card.status !== "active") return Response.json({ ok: false, error: "This gift card has already been fully used." });
  if (card.remaining_cents <= 0) return Response.json({ ok: false, error: "This gift card has no remaining balance." });

  return Response.json({ ok: true, remaining_cents: card.remaining_cents });
}
