import { createSign } from "crypto";
import { isAdmin } from "@/lib/admin-auth";

/**
 * Signs QZ Tray requests so QZ Tray trusts the admin site (public/qz-cert.pem)
 * and prints without asking each time. The private key is the base64 PEM in
 * QZ_PRIVATE_KEY.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const key = process.env.QZ_PRIVATE_KEY;
  if (!key) return new Response("QZ_PRIVATE_KEY is not set", { status: 500 });

  const toSign = await req.text();
  const signer = createSign("SHA512");
  signer.update(toSign);
  const signature = signer.sign(Buffer.from(key, "base64").toString("utf8"), "base64");
  return new Response(signature, { headers: { "Content-Type": "text/plain" } });
}
