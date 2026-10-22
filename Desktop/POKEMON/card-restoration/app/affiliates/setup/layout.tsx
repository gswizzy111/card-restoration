import type { Metadata } from "next";

// The setup token is in this page's address: never pass it on to other sites
export const metadata: Metadata = { referrer: "no-referrer" };

export default function CreatorSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
