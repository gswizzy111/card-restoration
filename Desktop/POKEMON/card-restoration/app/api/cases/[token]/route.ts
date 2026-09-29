import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: c } = await admin
    .from("cases")
    .select("id, complaint_submitted_at")
    .eq("token", token)
    .single();

  if (!c) return Response.json({ error: "Invalid link" }, { status: 404 });
  if (c.complaint_submitted_at) return Response.json({ error: "Already submitted" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const complaint = (body.complaint ?? "").trim();
  if (!complaint) return Response.json({ error: "Complaint is required" }, { status: 400 });

  const { error } = await admin
    .from("cases")
    .update({
      customer_complaint: complaint,
      complaint_submitted_at: new Date().toISOString(),
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
