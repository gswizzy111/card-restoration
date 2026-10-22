"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { FaqSection } from "./faq-data";

const INSTAGRAM = "https://www.instagram.com/the_card_doc";

// "Pokemon" finds "Pokémon"; case and accents don't matter
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The text with @the_card_doc linked and each search word highlighted. */
function Rich({ text, words }: { text: string; words: string[] }) {
  const parts = text.split(/(@the_card_doc)/);
  return (
    <>
      {parts.map((part, i) =>
        part === "@the_card_doc" ? (
          <a key={i} href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1a8fe0] hover:underline">
            @the_card_doc
          </a>
        ) : (
          <Highlight key={i} text={part} words={words} />
        )
      )}
    </>
  );
}

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const folded = fold(text);
  const marks: [number, number][] = [];
  for (const w of words) {
    let at = folded.indexOf(w);
    while (at !== -1) {
      marks.push([at, at + w.length]);
      at = folded.indexOf(w, at + w.length);
    }
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of marks) {
    if (start < pos) continue;
    if (start > pos) out.push(text.slice(pos, start));
    out.push(<mark key={start} className="rounded-sm bg-[#1a8fe0]/15 text-foreground">{text.slice(start, end)}</mark>);
    pos = end;
  }
  out.push(text.slice(pos));
  return <>{out}</>;
}

export function FaqSearch({ sections }: { sections: FaqSection[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const words = useMemo(() => fold(query).split(/\s+/).filter((w) => w.length > 1), [query]);
  const searching = words.length > 0;

  // A question matches when every word appears in it or in its answer
  const results = useMemo(() => {
    if (!searching) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((it) => words.every((w) => fold(`${it.q} ${it.a}`).includes(w))) }))
      .filter((s) => s.items.length > 0);
  }, [sections, words, searching]);
  const count = results.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">Search the FAQ</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions, e.g. slab, PSA, drop-off"
          autoComplete="off"
          className="w-full h-14 rounded-xl border border-border bg-white pl-12 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a8fe0]/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Topics, or the result count while searching */}
      <div className="mt-4 min-h-8" aria-live="polite">
        {searching ? (
          <p className="font-mono text-xs text-muted-foreground py-2">
            {count === 0 ? "No questions match" : `${count} question${count === 1 ? "" : "s"} match`} &ldquo;{query.trim()}&rdquo;
          </p>
        ) : (
          <nav aria-label="FAQ topics" className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-border bg-white px-3.5 py-1.5 text-sm text-foreground hover:border-foreground/40 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        )}
      </div>

      {count === 0 ? (
        <div className="mt-10 rounded-xl border border-border bg-white px-6 py-10 text-center">
          <p className="font-serif text-xl font-medium text-foreground">Nothing here yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask us directly: DM{" "}
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1a8fe0] hover:underline">@the_card_doc</a>{" "}
            on Instagram.
          </p>
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-14">
          {results.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
                {section.title}
              </h2>
              {/* While searching every match is open, so the answer is right there */}
              <Accordion key={searching ? `s-${query}` : "all"} multiple defaultValue={searching ? section.items.map((it) => it.q) : []} className="border-t border-border">
                {section.items.map((item) => (
                  <AccordionItem key={item.q} value={item.q} className="border-b border-border">
                    <AccordionTrigger className="text-base font-medium text-foreground py-4 hover:no-underline">
                      <Highlight text={item.q} words={words} />
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[15px] md:text-base text-muted-foreground leading-relaxed pb-5 max-w-[65ch]">
                        <Rich text={item.a} words={words} />
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
