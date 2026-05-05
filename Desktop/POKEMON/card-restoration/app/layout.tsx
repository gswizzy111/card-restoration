import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["800", "900"],
});

export const metadata: Metadata = {
  title: "The Card Doc — PSA Prep & Card Restoration",
  description:
    "Professional Pokémon and trading card restoration. PSA prep, full restoration, and expert cleaning. Mail us your cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
