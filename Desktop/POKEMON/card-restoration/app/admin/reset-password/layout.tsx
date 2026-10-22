import type { Metadata } from "next";

// The reset token is in this page's address: never pass it on to other sites
export const metadata: Metadata = { referrer: "no-referrer" };

export default function AdminResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
