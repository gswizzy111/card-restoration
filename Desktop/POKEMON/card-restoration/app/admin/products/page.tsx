import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionPriceCents } from "@/lib/store-config";
import Link from "next/link";
import { ProductReorderList } from "./product-reorder-list";
import { SubscriptionPriceEditor } from "./subscription-price-editor";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = createAdminClient();
  const [{ data: products }, subscriptionPriceCents] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price_cents, category, inventory_count, active, slug")
      .order("display_order", { ascending: true }),
    getSubscriptionPriceCents(),
  ]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary mb-2 block">← Orders</Link>
            <h1 className="font-heading font-black text-3xl text-foreground">Products</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {products?.length ?? 0} total · drag to reorder
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            + Add Product
          </Link>
        </div>

        {products && products.length > 0 ? (
          <ProductReorderList initialProducts={products} />
        ) : (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No products yet. <Link href="/admin/products/new" className="text-primary font-medium">Add your first product →</Link>
          </div>
        )}

        {/* Monthly subscription pricing */}
        <div className="bg-white rounded-xl border border-border p-6 mt-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Monthly Kit Club</h2>
          <p className="text-xs text-muted-foreground mb-4">Price charged at checkout for new subscriptions.</p>
          <SubscriptionPriceEditor initialPriceCents={subscriptionPriceCents} />
        </div>
      </div>
    </div>
  );
}
