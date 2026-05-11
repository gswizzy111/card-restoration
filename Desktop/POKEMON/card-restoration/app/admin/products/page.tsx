import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("id, name, price_cents, category, inventory_count, active, slug")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary mb-2 block">← Orders</Link>
            <h1 className="font-heading font-black text-3xl text-foreground">Products</h1>
            <p className="text-muted-foreground text-sm mt-1">{products?.length ?? 0} total</p>
          </div>
          <Link
            href="/admin/products/new"
            className="bg-primary text-white font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            + Add Product
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {products?.map((product) => (
            <Link
              key={product.id}
              href={`/admin/products/${product.id}`}
              className="bg-white rounded-xl border border-border p-5 flex items-center gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-heading font-black text-foreground">{product.name}</p>
                  {!product.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Hidden</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className={`font-bold ${product.inventory_count === 0 ? "text-red-600" : "text-foreground"}`}>
                    {product.inventory_count}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading font-black text-primary text-lg">{formatCurrency(product.price_cents)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {(!products || products.length === 0) && (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No products yet. <Link href="/admin/products/new" className="text-primary font-medium">Add your first product →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
