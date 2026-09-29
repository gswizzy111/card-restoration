import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTestimonials } from "@/lib/testimonials";
import { TestimonialsManager } from "./testimonials-manager";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const images = await getTestimonials();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading font-black text-3xl text-foreground">Customer Reviews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload screenshots from your Instagram customer reviews highlight. These appear on the Restorations and Shop pages.
        </p>
      </div>
      <TestimonialsManager initialImages={images} />
    </div>
  );
}
