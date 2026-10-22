import type { Metadata } from "next";
import Link from "next/link";
import { LinkedText } from "@/components/legal/linked-text";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED } from "@/lib/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Service | The Card Doc",
  description: "The terms that apply to restoration, prep and shop orders with The Card Doc LLC.",
};

const LINK = "font-semibold text-primary underline underline-offset-2 hover:opacity-80";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {TERMS_UPDATED}</p>

        <nav aria-label="Sections" className="mb-10 rounded-xl border border-border bg-secondary/30 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Contents</p>
          <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {TERMS_SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-foreground hover:text-primary">{s.title}</a></li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Signed at checkout when they apply:{" "}
            <Link href="/agreements/slab-removal" className={LINK}>Slab-Removal Authorization</Link> ·{" "}
            <Link href="/agreements/high-value" className={LINK}>High-Value Card Agreement</Link>
          </p>
        </nav>

        <div className="space-y-4 text-foreground leading-relaxed">
          {TERMS_INTRO.map((p) => <p key={p}>{p}</p>)}
        </div>
        {TERMS_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 mt-10">
            <h2 className="text-2xl font-bold font-heading mb-4">{s.title}</h2>
            <div className="space-y-4 text-foreground leading-relaxed">
              {s.blocks.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i}><LinkedText text={b} linkClassName={LINK} /></p>
                ) : (
                  <ul key={i} className="list-disc pl-6 space-y-2">
                    {b.list.map((item) => <li key={item}><LinkedText text={item} linkClassName={LINK} /></li>)}
                  </ul>
                )
              )}
            </div>
          </section>
        ))}
        <p className="text-xs text-muted-foreground text-center mt-12">© {new Date().getFullYear()} The Card Doc LLC</p>
      </div>
    </div>
  );
}
