import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveLabel, getTermsVersion } from "@/lib/terms-versions";
import { termsPdf } from "@/lib/pdf/terms-pdf";

/** /terms/v1.0/pdf: that version of the Terms as a PDF download. */
export async function GET(_request: Request, { params }: { params: Promise<{ version: string }> }) {
  const version = decodeURIComponent((await params).version).replace(/^v/i, "");
  if (!/^\d+(\.\d+)*$/.test(version)) return new Response("Not found", { status: 404 });
  const row = await getTermsVersion(createAdminClient(), version);
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = await termsPdf({
    version: row.version,
    effectiveLabel: effectiveLabel(row.effective_date),
    markdown: row.content_markdown,
    sha256: row.content_sha256,
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="The-Card-Doc-Terms-of-Service-v${row.version}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
