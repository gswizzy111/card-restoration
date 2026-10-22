import Link from "next/link";
import { AGREEMENTS_VERSION, type AgreementText } from "@/lib/agreements";

/** A checkout agreement's public page: the wording customers sign, as a template. */
export function AgreementPage({ agreement, when }: { agreement: AgreementText; when: string }) {
  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">{agreement.title}</h1>
        <p className="text-muted-foreground mb-8">{when}</p>
        <div className="rounded-xl border border-border p-6 md:p-8">
          <p className="text-foreground leading-relaxed">{agreement.intro}</p>
          <ol className="mt-4 list-decimal pl-6 space-y-2.5 text-muted-foreground leading-relaxed">
            {agreement.points.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
          <p className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
            Signed at checkout with your typed name; the date is recorded when you place the order. Version {AGREEMENTS_VERSION}.
          </p>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          These sit alongside our <Link href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
}
