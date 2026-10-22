import { endCreatorSession } from "@/lib/creator-portal";

// A 303 so the browser follows the form post with a GET, and a relative
// Location so it stays on the domain it is on
export async function POST() {
  await endCreatorSession();
  return new Response(null, { status: 303, headers: { Location: "/affiliates" } });
}
