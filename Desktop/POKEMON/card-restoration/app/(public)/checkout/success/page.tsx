import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <section className="flex-1 flex items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <CheckCircle className="h-16 w-16 text-primary" />
        <h1 className="font-heading font-black text-4xl text-foreground">Order Confirmed</h1>
        <p className="text-muted-foreground">
          Thank you! We&apos;ll be in touch soon with next steps.
        </p>
        <Button render={<Link href="/" />} className="font-bold px-8">
          Back to Home
        </Button>
      </div>
    </section>
  );
}
