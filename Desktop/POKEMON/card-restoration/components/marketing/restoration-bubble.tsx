"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Booking and checkout pages, where the button would cover the form: the
// restoration and prep order forms, the cart and its checkout, gift cards,
// subscriptions and the pages a payment returns to.
const HIDE_ON = [
  "/restoration",
  "/tier-selection",
  "/order",
  "/prep/order",
  "/cart",
  "/checkout",
  "/gift-cards",
  "/subscribe",
  "/shop/order-confirmed",
];

/** True on a listed page or anything under it ("/cart" hides "/cart/checkout"). */
export function hidesBookingButton(pathname: string) {
  return HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function RestorationBubble() {
  const pathname = usePathname();
  if (hidesBookingButton(pathname)) return null;

  return (
    <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50 px-4 md:hidden">
      <Link
        href="/restoration"
        className="flex items-center gap-2.5 bg-[#1a8fe0] text-white font-black text-base px-7 py-4 rounded-full shadow-2xl active:scale-95 transition-transform"
        style={{ boxShadow: "0 8px 32px rgba(26,143,224,0.45)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/card-doctor.jpg" alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        Book a Restoration
      </Link>
    </div>
  );
}
