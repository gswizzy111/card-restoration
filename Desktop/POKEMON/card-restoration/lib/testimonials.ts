import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "app-config";
const FILE = "testimonials.json";

export interface TestimonialImage {
  id: string;
  url: string;
  alt?: string;
}

export interface TestimonialsConfig {
  images: TestimonialImage[];
}

const FALLBACK: TestimonialImage[] = [
  { id: "t1",  url: "/testimonial-1.jpeg",  alt: "Customer review" },
  { id: "t2",  url: "/testimonial-2.jpeg",  alt: "Customer review" },
  { id: "t3",  url: "/testimonial-3.jpeg",  alt: "Customer review" },
  { id: "t4",  url: "/testimonial-4.jpeg",  alt: "Customer review" },
  { id: "t5",  url: "/testimonial-5.png",   alt: "Customer review" },
  { id: "t6",  url: "/testimonial-6.png",   alt: "Customer review" },
  { id: "t11", url: "/testimonial-11.png",  alt: "Customer review" },
  { id: "t12", url: "/testimonial-12.png",  alt: "Customer review" },
  { id: "t13", url: "/testimonial-13.png",  alt: "Customer review" },
];

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

export async function getTestimonials(): Promise<TestimonialImage[]> {
  const admin = createAdminClient();
  await ensureBucket(admin);
  const { data, error } = await admin.storage.from(BUCKET).download(FILE);
  if (error || !data) return FALLBACK;
  try {
    const parsed: TestimonialsConfig = JSON.parse(await data.text());
    return parsed.images?.length ? parsed.images : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function saveTestimonials(images: TestimonialImage[]): Promise<void> {
  const admin = createAdminClient();
  await ensureBucket(admin);
  const blob = new Blob([JSON.stringify({ images }, null, 2)], { type: "application/json" });
  await admin.storage.from(BUCKET).upload(FILE, blob, { upsert: true, contentType: "application/json" });
}
