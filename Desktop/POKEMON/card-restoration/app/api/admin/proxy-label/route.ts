import { cookies } from "next/headers";

export async function HEAD(req: Request) {
  return GET(req);
}

export async function GET(req: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url param", { status: 400 });

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return new Response("Failed to fetch label", { status: 502 });

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        // Tell client what format this is so it can choose PDF vs ZPL printing
        "X-Label-Format": contentType.includes("pdf") ? "pdf" : "zpl",
      },
    });
  } catch (err) {
    return new Response(String(err), { status: 502 });
  }
}
