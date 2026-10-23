import Link from "next/link";
import { Download } from "lucide-react";
import type { DocBlock } from "@/lib/legal/legal-doc";
import { LegalDocument } from "./legal-document";

const LINK = "font-semibold text-primary underline underline-offset-2 hover:opacity-80";

/**
 * One version of the Terms of Service: version and effective date up top, a
 * PDF download, contents, and the text exactly as published.
 */
export function TermsView({
  version,
  effectiveLabel,
  blocks,
  notice,
  otherVersions = [],
}: {
  version: string;
  effectiveLabel: string;
  blocks: DocBlock[];
  /** Shown above the text, e.g. on an earlier version's page. */
  notice?: React.ReactNode;
  otherVersions?: { version: string; label: string }[];
}) {
  const headings = blocks.filter((b): b is Extract<DocBlock, { kind: "heading" }> => b.kind === "heading");
  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-5">Version {version} · Effective {effectiveLabel}</p>
        <a
          href={`/terms/v${version}/pdf`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors mb-8"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Download PDF
        </a>

        {notice && <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950 leading-relaxed">{notice}</div>}

        <details className="mb-10 rounded-xl border border-border bg-secondary/30 p-5">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted-foreground">Contents ({headings.length} sections)</summary>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {headings.map((h) => (
              <li key={h.id}><a href={`#${h.id}`} className="text-foreground hover:text-primary">{h.text}</a></li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Signed separately when it applies:{" "}
            <Link href="/agreements/slab-removal" className={LINK}>Slab Removal Authorization</Link>
          </p>
          {otherVersions.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Other versions:{" "}
              {otherVersions.map((v, i) => (
                <span key={v.version}>{i > 0 && " · "}<Link href={`/terms/v${v.version}`} className="underline underline-offset-2 hover:text-foreground">{v.label}</Link></span>
              ))}
            </p>
          )}
        </details>

        <article className="text-foreground">
          <LegalDocument blocks={blocks} />
        </article>
      </div>
    </div>
  );
}
