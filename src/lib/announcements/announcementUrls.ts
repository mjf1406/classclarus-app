/** Absolute public announcement URL: `{origin}{BASE_URL}a/{publicSlug}` */
export function announcementPublicUrl(publicSlug: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const origin = window.location.origin.replace(/\/$/, "");
  const root = `${origin}${base.startsWith("/") ? base : `/${base}`}`;
  return new URL(`a/${encodeURIComponent(publicSlug)}`, root).href;
}
