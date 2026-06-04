import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ManualOrderForm } from "./manual-order-form";

export const dynamic = "force-dynamic";

export default async function NewManualOrderPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← All Orders
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Create Manual Order</h1>
          <p className="text-muted-foreground text-sm mt-1">Add a restoration order manually — no Stripe payment required.</p>
        </div>
        <ManualOrderForm />
      </div>
    </div>
  );
}
