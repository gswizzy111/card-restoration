// Card photos are full-size uploads (often 100–400 KB) that admin lists show as
// small squares. On Netlify, a Supabase storage photo is served resized by
// Netlify's image CDN (allowed in netlify.toml); anywhere else, unchanged.
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

/** A square thumbnail of `url` for display at `size` CSS pixels. */
export function thumbnail(url: string, size: number) {
  if (process.env.IMAGE_CDN !== "netlify" || !url.startsWith(STORAGE_PREFIX)) return url;
  const px = size * 2; // sharp on high-density screens
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=${px}&h=${px}&fit=cover`;
}
