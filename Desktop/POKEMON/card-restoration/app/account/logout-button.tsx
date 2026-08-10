"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/account/auth/logout", { method: "POST" });
    router.push("/account/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
    >
      Sign out
    </button>
  );
}
