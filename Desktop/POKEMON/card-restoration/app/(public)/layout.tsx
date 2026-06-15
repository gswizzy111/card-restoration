import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { CountdownTicker } from "@/components/marketing/countdown-ticker";
import { CartProvider } from "@/lib/cart-context";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <CountdownTicker />
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </CartProvider>
  );
}
