import { ProductForm } from "../product-form";

export default function NewProductPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <a href="/admin/products" className="text-sm text-muted-foreground hover:text-primary block mb-2">← Products</a>
          <h1 className="font-heading font-black text-3xl text-foreground">Add Product</h1>
        </div>
        <ProductForm />
      </div>
    </div>
  );
}
