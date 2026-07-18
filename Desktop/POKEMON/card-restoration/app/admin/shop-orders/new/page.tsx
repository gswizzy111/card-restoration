import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ManualKitOrderForm } from "./manual-kit-order-form";

export const dynamic = "force-dynamic";

export default async function NewKitOrderPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("id, name, price_cents")
    .eq("active", true)
    .order("name");

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/admin/shop-orders" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Kit Orders
          </Link>
          <h1 className="font-heading font-black text-3xl text-foreground mt-4">New Kit Order</h1>
          <p className="text-muted-foreground text-sm mt-1">Manual order — no Stripe session required</p>
        </div>
        <ManualKitOrderForm products={products ?? []} />
      </div>
    </div>
  );
}
