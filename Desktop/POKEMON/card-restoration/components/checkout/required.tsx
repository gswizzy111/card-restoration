"use client";

/**
 * Required fields at checkout: a red asterisk on every required label, and
 * once the customer presses Continue / Sign / Pay with something left out, a
 * red box around each field still missing, with the page scrolled to the
 * first one. Shared by every checkout form on both sites.
 */

/** The red asterisk after a required field's label. */
export function Req() {
  return (
    <span className="text-red-600 font-bold" aria-hidden="true">
      {" "}*
    </span>
  );
}

/** Wraps one required field (label and input): a red box and a note while it's missing. */
export function Need({
  missing,
  note = "Required",
  className = "",
  children,
}: {
  missing: boolean;
  /** What to do, shown under the field; null for none */
  note?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-missing={missing || undefined}
      className={`${className} rounded-md transition-[outline-color] ${missing ? "outline-2 outline-offset-4 outline-red-600" : "outline-0 outline-transparent"}`}
    >
      {children}
      {missing && note && <p className="mt-1.5 text-xs font-semibold text-red-700" role="alert">{note}</p>}
    </div>
  );
}

/** Scrolls to the first missing field (inside `root`, or the whole page) and puts the cursor in it. */
export function revealMissing(root?: HTMLElement | null) {
  // After React has drawn the red boxes
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = (root ?? document).querySelector<HTMLElement>("[data-missing]");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.querySelector<HTMLElement>("input:not([disabled]):not([type=hidden]), select, textarea")?.focus({ preventScroll: true });
  }));
}

/** The line under a Continue / Sign button after a try with something missing. */
export function MissingNote({ show, text = "Please fill in the fields outlined in red." }: { show: boolean; text?: string }) {
  if (!show) return null;
  return <p className="mt-3 text-sm font-semibold text-red-700 sm:text-right" role="alert">{text}</p>;
}
