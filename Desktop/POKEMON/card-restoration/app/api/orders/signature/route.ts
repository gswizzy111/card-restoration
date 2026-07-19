import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { dataUrl } = await request.json();

  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) {
    return Response.json({ error: "Invalid signature data" }, { status: 400 });
  }

  const base64 = dataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");
  const path = `signatures/${crypto.randomUUID()}.png`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("card-photos")
    .upload(path, buffer, { contentType: "image/png", upsert: false });

  if (error) {
    console.error("Signature upload error:", error);
    return Response.json({ error: "Failed to save signature" }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("card-photos").getPublicUrl(path);

  return Response.json({ path, url: publicUrl });
}
