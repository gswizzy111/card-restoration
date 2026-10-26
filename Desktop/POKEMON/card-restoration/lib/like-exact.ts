/**
 * Text as an ILIKE pattern that matches only itself (case-insensitively).
 * "_" and "%" are wildcards in LIKE, so without this an account email such as
 * j_hn@example.com would also match john@example.com's orders.
 */
export function likeExact(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
