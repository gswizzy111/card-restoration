import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ShopOrderConfirmedPage() {
  return (
    <section className="flex-1 flex items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-primary" />
        <div>
          <h1 className="font-heading font-black text-4xl text-foreground mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground text-sm">Thanks for your order. We&apos;ll ship it out shortly and send you a tracking number.</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <Button render={<Link href="/shop" />} className="font-bold w-full">Continue Shopping</Button>
          <Button variant="outline" render={<Link href="/" />} className="font-bold w-full border-2">Back to Home</Button>
        </div>
      </div>
    </section>
  );
}
