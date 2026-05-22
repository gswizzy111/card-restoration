export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", "partner_session=; Path=/; HttpOnly; Max-Age=0");
  return response;
}
