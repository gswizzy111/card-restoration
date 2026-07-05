import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { CountdownTicker } from "@/components/marketing/countdown-ticker";
import { RestorationBubble } from "@/components/marketing/restoration-bubble";
import { CartProvider } from "@/lib/cart-context";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="sticky top-0 z-50">
        <Nav />
        <CountdownTicker />
      </div>
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <RestorationBubble />
    </CartProvider>
  );
}
