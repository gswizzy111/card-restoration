"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PROBLEM_LABELS, problemAdvice, type EmailProblem } from "@/lib/email-problem-labels";

const TYPE_COLORS: Record<EmailProblem["type"], string> = {
  bounced: "bg-red-100 text-red-800",
  complained: "bg-orange-100 text-orange-800",
  suppressed: "bg-red-100 text-red-800",
  failed: "bg-yellow-100 text-yellow-800",
};

function when(iso: string | null) {
  if (!iso) return "";
  return `${new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`;
}

function ProblemLine({ p }: { p: EmailProblem }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[p.type]}`}>{PROBLEM_LABELS[p.type]}</span>
        <span className="text-xs text-muted-foreground">{when(p.received_at)}</span>
      </div>
      {p.subject && <p className="text-xs text-muted-foreground mt-1 break-words">Email: &ldquo;{p.subject}&rdquo;{p.sent_at ? ` · sent ${when(p.sent_at)}` : ""}</p>}
      {p.detail && <p className="text-xs text-muted-foreground mt-0.5 font-mono break-words">{p.detail}</p>}
    </div>
  );
}

export function EmailProblemsClient({ initialProblems }: { initialProblems: EmailProblem[] }) {
  const router = useRouter();
  const [problems, setProblems] = useState(initialProblems);
  const [busy, setBusy] = useState<string | null>(null);

  // ids: for Mark fixed, every open row the card shows
  async function setResolved(id: string, resolved: boolean, ids?: string[]) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/email-problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved, ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? "Could not update it"); return; }
      const changed = new Set<string>(data.ids ?? []);
      setProblems((list) => list.map((p) => (changed.has(p.id) ? { ...p, resolved_at: data.resolved_at ?? null } : p)));
      toast.success(resolved ? "Marked fixed" : "Opened again");
      // The nav badge and the page's count come from the server
      router.refresh();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  // Open problems grouped by address (newest first); fixed ones listed after
  const open = new Map<string, EmailProblem[]>();
  for (const p of problems) if (!p.resolved_at) open.set(p.email, [...(open.get(p.email) ?? []), p]);
  const fixed = problems.filter((p) => p.resolved_at);

  if (problems.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-16 text-center">
        <p className="text-4xl mb-3">✓</p>
        <p className="font-heading font-black text-xl text-foreground mb-1">No email problems</p>
        <p className="text-sm text-muted-foreground">When an email bounces, is marked as spam or is blocked, the address shows up here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {open.size === 0 && <p className="text-sm text-muted-foreground">Nothing open. Every address below was marked fixed.</p>}
        {[...open.entries()].map(([email, list]) => (
          <div key={email} className="bg-white rounded-xl border border-red-200 px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground break-all">{email}</p>
                <p className="text-xs text-foreground mt-1">{problemAdvice(list[0].type)}</p>
                <div className="mt-3 border-t border-border pt-3">
                  {list.map((p) => <ProblemLine key={p.id} p={p} />)}
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                <Link href={`/admin?q=${encodeURIComponent(email)}`} className="text-xs font-semibold text-primary hover:underline">
                  Find their orders
                </Link>
                <button
                  type="button"
                  onClick={() => setResolved(list[0].id, true, list.map((p) => p.id))}
                  disabled={busy === list[0].id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {busy === list[0].id ? "Saving…" : "Mark fixed"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {fixed.length > 0 && (
        <section>
          <h2 className="font-heading font-black text-lg text-foreground mb-3">Fixed</h2>
          <div className="flex flex-col gap-2">
            {fixed.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-border px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground break-all">{p.email}</p>
                  <ProblemLine p={p} />
                  <p className="text-xs text-green-700 mt-1">Marked fixed {when(p.resolved_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setResolved(p.id, false)}
                  disabled={busy === p.id}
                  className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  {busy === p.id ? "Saving…" : "Open again"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
