import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { TERMS_VERSION, termsSource } from "@/lib/legal/current-terms";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED } from "@/lib/legal/terms";

type Admin = ReturnType<typeof createAdminClient>;

export type TermsVersionRow = {
  id: string;
  version: string;
  effective_date: string;
  content_markdown: string;
  content_sha256: string;
  pdf_url: string | null;
  created_at: string;
};

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * The interim Terms (lib/legal/terms.ts, "last updated October 22, 2026")
 * that orders were signed under before v1.0, kept readable as version 0.9.
 */
const INTERIM_VERSION = "0.9";
function interimMarkdown(): string {
  return [
    "# Terms of Service",
    `Last updated ${TERMS_UPDATED}.`,
    ...TERMS_INTRO,
    ...TERMS_SECTIONS.flatMap((s) => [
      `## ${s.title}`,
      ...s.blocks.map((b) => (typeof b === "string" ? b : b.list.map((i) => `- ${i}`).join("\n"))),
    ]),
  ].join("\n\n") + "\n";
}

/** What each version's row is built from, by version. */
function source(version: string): { markdown: string; effective: string } | null {
  if (version === INTERIM_VERSION) return { markdown: interimMarkdown(), effective: "2026-10-22" };
  const src = termsSource(version);
  return src && { markdown: src.markdown, effective: src.effectiveIso };
}

/**
 * The stored row for a version, created the first time it's needed. Rows never
 * change (a database trigger refuses it), so if the text in the code differs
 * from what was stored, the Terms were edited without a new version number:
 * this throws rather than let anyone sign text that isn't on record.
 */
export async function ensureTermsVersion(admin: Admin, version = TERMS_VERSION): Promise<TermsVersionRow> {
  const src = source(version);
  const { data: existing } = await admin.from("terms_versions").select("*").eq("version", version).maybeSingle();
  if (existing) {
    if (src && existing.content_sha256 !== sha256(src.markdown)) {
      throw new Error(`Terms v${version} changed after it was published. Save the new text as a new version (legal/terms-v<next>.md) instead.`);
    }
    return existing as TermsVersionRow;
  }
  if (!src) throw new Error(`Unknown Terms version ${version}`);
  const row = {
    version,
    effective_date: src.effective,
    content_markdown: src.markdown,
    content_sha256: sha256(src.markdown),
    pdf_url: `/terms/v${version}/pdf`,
  };
  const { error } = await admin.from("terms_versions").upsert(row, { onConflict: "version", ignoreDuplicates: true });
  if (error) throw new Error(`Saving Terms v${version} failed: ${error.message}`);
  const { data } = await admin.from("terms_versions").select("*").eq("version", version).single();
  return data as TermsVersionRow;
}

/**
 * A published version by its number ("1.0"), or null, for showing it. Known
 * versions are stored on first view; when the database can't be written (a
 * preview deploy) a known version is shown from the code instead (id "").
 */
export async function getTermsVersion(admin: Admin, version: string): Promise<TermsVersionRow | null> {
  const src = source(version);
  if (src) {
    try {
      return await ensureTermsVersion(admin, version);
    } catch (err) {
      console.error(`Terms v${version}:`, err instanceof Error ? err.message : err);
      const { data } = await admin.from("terms_versions").select("*").eq("version", version).maybeSingle();
      if (data) return data as TermsVersionRow;
      return {
        id: "",
        version,
        effective_date: src.effective,
        content_markdown: src.markdown,
        content_sha256: sha256(src.markdown),
        pdf_url: `/terms/v${version}/pdf`,
        created_at: new Date().toISOString(),
      };
    }
  }
  const { data } = await admin.from("terms_versions").select("*").eq("version", version).maybeSingle();
  return (data as TermsVersionRow | null) ?? null;
}

/** "October 22, 2026" from "2026-10-22". */
export function effectiveLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
