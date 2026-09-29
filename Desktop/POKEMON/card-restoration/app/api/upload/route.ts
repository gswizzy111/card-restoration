import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB server hard cap

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "Invalid request" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  // Accept any image format — HEIC, JPEG, PNG, WEBP, etc.
  if (file.type && !file.type.startsWith("image/")) {
    return Response.json({ error: "Only image files are allowed." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.` }, { status: 400 });
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = (rawExt === "heic" || rawExt === "heif") ? "jpg" : rawExt;
  const filename = `${crypto.randomUUID()}.${ext}`;
  const contentType = (rawExt === "heic" || rawExt === "heif") ? "image/jpeg" : (file.type || "image/jpeg");

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from("card-photos")
    .upload(filename, buffer, { contentType, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(filename);
  return Response.json({ url: publicUrl });
}

// Presigned upload URL — client uploads directly to Supabase, bypassing Netlify body limits
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.filename) return Response.json({ error: "filename required" }, { status: 400 });

  const contentType = (body.contentType as string) || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return Response.json({ error: "Only image files are allowed." }, { status: 400 });
  }

  const rawExt = (body.filename as string).split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = (rawExt === "heic" || rawExt === "heif") ? "jpg" : rawExt;
  const filename = `${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("card-photos")
    .createSignedUploadUrl(filename);

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Could not create upload URL" }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(filename);
  return Response.json({ signedUrl: data.signedUrl, path: filename, publicUrl });
}
