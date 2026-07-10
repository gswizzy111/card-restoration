"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";

const links = [
  { href: "/shop", label: "Kits" },
  { href: "/restoration", label: "Restorations" },
  { href: "/about", label: "About Us" },
  { href: "/gift-cards", label: "Gift Cards" },
  { href: "/track", label: "Track Order" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

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
          <span className="font-heading text-xl font-bold text-white">The Card Doc</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white hover:text-white/80 transition-colors duration-150"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <Link href="/cart" className="relative p-1.5 text-white hover:text-white/80 transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-white text-[#1a8fe0] text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            href="/restoration"
            className="text-sm font-bold text-[#1a8fe0] bg-white border border-white px-4 py-2 hover:bg-white/90 transition-colors duration-150 rounded-lg"
          >
            Book Restoration
          </Link>
        </div>

        {/* Mobile */}
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

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-[#1a8fe0] border-t border-[#1570c9] px-6 py-6 flex flex-col gap-5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-base font-medium text-white hover:text-white/80 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/restoration"
            onClick={() => setOpen(false)}
            className="text-sm font-bold text-[#1a8fe0] bg-white border border-white px-4 py-3 text-center hover:bg-white/90 transition-colors rounded-lg"
          >
            Book Restoration
          </Link>
        </div>
      )}
    </header>
  );
}
