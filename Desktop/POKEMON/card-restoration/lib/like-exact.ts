/**
 * Text as an ILIKE pattern that matches only itself (case-insensitively).
 * "_" and "%" are wildcards in LIKE, so without this an account email such as
 * j_hn@example.com would also match john@example.com's orders.
 *
 * PostgREST also reads "*" as "%", and that can't be escaped (it turns "\*"
 * into "\%", a literal percent sign). Text with a "*" gets a pattern that
 * matches nothing: no email or code we store has one.
 */
const NO_MATCH = "no match@@";

export function likeExact(text: string) {
  if (text.includes("*")) return NO_MATCH;
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
