import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { signedPdfResponse } from "@/lib/signed-pdf-download";

/** An admin downloads a signed PDF. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  return signedPdfResponse(createAdminClient(), id);
}
