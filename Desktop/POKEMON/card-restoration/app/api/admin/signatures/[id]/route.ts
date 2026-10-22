import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { signedPdfResponse } from "@/lib/signed-pdf-download";

/** An admin downloads a signed PDF (?executed=1: a high-value agreement with both signatures). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  return signedPdfResponse(createAdminClient(), id, new URL(request.url).searchParams.get("executed") === "1");
}
