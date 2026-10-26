import type { Metadata } from "next";

// The invite token is in this page's address: never pass it on to other pages or sites
export const metadata: Metadata = { referrer: "no-referrer" };

export default function AccountantSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
