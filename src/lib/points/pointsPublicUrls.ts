/** Absolute public points display URL: `{origin}{BASE_URL}p/{publicSlug}` */
export function pointsPublicDisplayUrl(publicSlug: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const origin = window.location.origin.replace(/\/$/, "");
  const root = `${origin}${base.startsWith("/") ? base : `/${base}`}`;
  return new URL(`p/${encodeURIComponent(publicSlug)}`, root).href;
}
