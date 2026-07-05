import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { CountdownTicker } from "@/components/marketing/countdown-ticker";
import { CartProvider } from "@/lib/cart-context";
import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="sticky top-0 z-50">
        <Nav />
        <CountdownTicker />
      </div>
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />

      {/* Mobile floating "Book Restoration" bubble — hidden on desktop */}
      <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50 px-4 md:hidden">
        <Link
          href="/restoration"
          className="flex items-center gap-2.5 bg-[#1a8fe0] text-white font-black text-base px-7 py-4 rounded-full shadow-2xl active:scale-95 transition-transform"
          style={{ boxShadow: "0 8px 32px rgba(26,143,224,0.45)" }}
        >
          <span className="text-xl">🃏</span>
          Book a Restoration
        </Link>
      </div>
    </CartProvider>
  );
}
