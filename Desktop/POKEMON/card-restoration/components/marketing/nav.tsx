"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, ShoppingCart, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";

// Primary service tabs — shown prominently
const TABS = [
  { href: "/tier-selection", label: "Restorations", match: ["/tier-selection", "/restoration"] },
  { href: "/prep", label: "Prep", match: ["/prep"] },
  { href: "/shop", label: "Kits", match: ["/shop", "/cart"] },
];

// Secondary nav links
const SEC_LINKS = [
  { href: "/track", label: "Track Order" },
  { href: "/gift-cards", label: "Gift Cards" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function isTabActive(tab: typeof TABS[number]) {
    return tab.match.some((m) => pathname.startsWith(m));
  }

  return (
    <header
      className={`relative bg-[#1a8fe0] transition-shadow duration-200 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 md:px-10 h-[70px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/card-doctor.jpg" alt="The Card Doc" className="w-9 h-9 rounded-full object-cover" />
          <span className="font-heading text-xl font-bold text-white hidden sm:block">The Card Doc</span>
        </Link>

        {/* Desktop — three service tabs in the center */}
        <div className="hidden md:flex items-center gap-1 bg-white/10 rounded-xl p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors duration-150 ${
                isTabActive(tab)
                  ? "bg-white text-[#1a8fe0]"
                  : "text-white hover:bg-white/20"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          {SEC_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white/90 hover:text-white transition-colors duration-150"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/cart" className="relative p-1.5 text-white hover:text-white/80 transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-white text-[#1a8fe0] text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            className="text-sm font-medium text-white/90 hover:text-white transition-colors duration-150"
          >
            My Account
          </Link>
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/cart" className="relative p-1.5 text-white hover:text-white/80 transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-white text-[#1a8fe0] text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 text-white"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-[#1a8fe0] border-t border-[#1570c9] px-6 py-5 flex flex-col gap-4">
          {/* Service tabs */}
          <div className="grid grid-cols-3 gap-2">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className={`py-2.5 rounded-xl text-sm font-bold text-center transition-colors ${
                  isTabActive(tab)
                    ? "bg-white text-[#1a8fe0]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-white/20 pt-4 flex flex-col gap-3">
            {SEC_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-white/90 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              My Account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
