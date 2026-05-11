import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: product } = await admin.from("products").select("*").eq("id", id).single();
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <a href="/admin/products" className="text-sm text-muted-foreground hover:text-primary block mb-2">← Products</a>
          <h1 className="font-heading font-black text-3xl text-foreground">Edit Product</h1>
        </div>
        <ProductForm initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          price_cents: product.price_cents,
          category: product.category,
          inventory_count: product.inventory_count,
          active: product.active,
          images: product.images ?? [],
          weight_oz: product.weight_oz ?? 4,
        }} />
      </div>
    </div>
  );
}
