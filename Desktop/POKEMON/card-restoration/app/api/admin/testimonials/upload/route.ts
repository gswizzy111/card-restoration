import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return Response.json({ error: "Use JPEG, PNG, or WebP" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Max 10MB" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `testimonials/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  await admin.storage.createBucket("card-photos", { public: true }).catch(() => {});

  const { error } = await admin.storage
    .from("card-photos")
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(filename);
  return Response.json({ url: publicUrl });
}
