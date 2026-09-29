import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTestimonials, saveTestimonials } from "@/lib/testimonials";
import type { TestimonialImage } from "@/lib/testimonials";

async function auth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const images = await getTestimonials();
  return Response.json({ images });
}

export async function POST(request: Request) {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { images } = await request.json() as { images: TestimonialImage[] };
  if (!Array.isArray(images)) return Response.json({ error: "Invalid payload" }, { status: 400 });
  await saveTestimonials(images);
  return Response.json({ ok: true });
}

// DELETE a single image by id — also removes from storage if it's a Supabase URL
export async function DELETE(request: Request) {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json() as { id: string };
  const images = await getTestimonials();
  const target = images.find((img) => img.id === id);

  if (target) {
    // Try to delete from Supabase storage if it's a storage URL
    const match = target.url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      const [, bucket, path] = match;
      const admin = createAdminClient();
      await admin.storage.from(bucket).remove([path]).catch(() => {});
    }
  }

  await saveTestimonials(images.filter((img) => img.id !== id));
  return Response.json({ ok: true });
}
