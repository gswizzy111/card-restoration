import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type))
    return Response.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return Response.json({ error: "File too large. Max 5MB." }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("card-photos")
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(filename);
  return Response.json({ url: publicUrl });
}
