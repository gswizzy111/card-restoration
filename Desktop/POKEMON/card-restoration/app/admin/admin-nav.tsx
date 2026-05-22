"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin",             label: "Orders",      icon: "📋" },
  { href: "/admin/shop-orders", label: "Kit Orders",  icon: "📦" },
  { href: "/admin/partners",    label: "Partners",    icon: "🤝" },
  { href: "/admin/products",    label: "Products",    icon: "🛍️" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-56 shrink-0 min-h-screen bg-white border-r border-border flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <p className="font-heading font-black text-lg text-foreground">The Card Doc</p>
        <p className="text-xs text-muted-foreground mt-0.5">Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <span>📊</span>
          Analytics
        </a>
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <form action="/api/admin/logout" method="POST">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left">
            <span>🚪</span>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
