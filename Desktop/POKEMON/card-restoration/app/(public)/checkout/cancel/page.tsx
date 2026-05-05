import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <section className="flex-1 flex items-center justify-center py-24 px-6">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <h1 className="font-serif text-4xl font-medium text-foreground">
          Checkout cancelled.
        </h1>
        <p className="text-muted-foreground">
          Your order wasn&apos;t placed and you weren&apos;t charged. Your
          selections are still saved if you&apos;d like to return.
        </p>
        <Button render={<Link href="/order" />} className="px-8">
          Return to Order Builder
        </Button>
      </div>
    </section>
  );
}
