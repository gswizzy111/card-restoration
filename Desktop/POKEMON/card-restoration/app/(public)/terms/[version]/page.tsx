import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TermsView } from "@/components/legal/terms-view";
import { parseLegalMarkdown } from "@/lib/legal/legal-doc";
import { TERMS_VERSION } from "@/lib/legal/current-terms";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveLabel, getTermsVersion } from "@/lib/terms-versions";

type Props = { params: Promise<{ version: string }> };

const versionOf = (param: string) => decodeURIComponent(param).replace(/^v/i, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const version = versionOf((await params).version);
  return { title: `Terms of Service v${version} | The Card Doc`, robots: version === TERMS_VERSION ? undefined : { index: false } };
}

/** Any published version of the Terms, word for word as stored (terms_versions). */
export default async function TermsVersionPage({ params }: Props) {
  const version = versionOf((await params).version);
  if (!/^\d+(\.\d+)*$/.test(version)) notFound();
  const row = await getTermsVersion(createAdminClient(), version);
  if (!row) notFound();
  const current = version === TERMS_VERSION;
  return (
    <TermsView
      version={row.version}
      effectiveLabel={effectiveLabel(row.effective_date)}
      blocks={parseLegalMarkdown(row.content_markdown)}
      notice={current ? undefined : (
        <>
          This is version {row.version}, kept for orders placed under it. The version in effect for new orders is{" "}
          <Link href="/terms" className="font-semibold underline underline-offset-2">version {TERMS_VERSION}</Link>.
        </>
      )}
      otherVersions={current ? [] : [{ version: TERMS_VERSION, label: `Version ${TERMS_VERSION} (current)` }]}
    />
  );
}
