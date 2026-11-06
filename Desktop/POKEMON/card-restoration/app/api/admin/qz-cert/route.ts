import { isAdmin } from "@/lib/admin-auth";
import { QZ_CERT } from "@/lib/qz-cert";

/** The certificate QZ Tray checks signatures against; empty until QZ_PRIVATE_KEY is set, so printing still works (asking each time). */
export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  return new Response(process.env.QZ_PRIVATE_KEY ? QZ_CERT : "", { headers: { "Content-Type": "text/plain" } });
}
