"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Banner across the top of the admin while customers are waiting on a
 * reply to an update request. Hidden inside Cases, where the list already is.
 */
export function InquiryAlert({ count }: { count: number }) {
  const pathname = usePathname();
  if (count === 0 || pathname.startsWith("/admin/cases")) return null;

  // One string, so the compiler can't trim the spaces between the parts.
  const who = count === 1 ? "1 customer is" : `${count} customers are`;

  return (
    <Link
      href="/admin/cases?filter=open&type=inquiry"
      className="flex items-center justify-between gap-4 bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <span>{`📬 ${who} waiting on an order update`}</span>
      <span className="shrink-0 underline underline-offset-2">Reply →</span>
    </Link>
  );
}

/** Banner across the admin while support refund requests wait for approval. */
export function RefundRequestAlert({ count }: { count: number }) {
  const pathname = usePathname();
  const search = useSearchParams();
  if (count === 0 || (pathname === "/admin" && search.get("tab") === "refunds")) return null;
  const what = count === 1 ? "1 refund request is" : `${count} refund requests are`;
  return (
    <Link
      href="/admin?tab=refunds"
      className="flex items-center justify-between gap-4 bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
    >
      <span>{`💸 ${what} waiting for your approval`}</span>
      <span className="shrink-0 underline underline-offset-2">Review →</span>
    </Link>
  );
}
