/**
 * Best-effort public-share detection for assignment submission links.
 * Scoped to Google Docs/Sheets/Slides (and Drive file links) and Canva.
 *
 * Canva: verified signal is redirect to /login/ for private designs vs staying on
 * /design/... for public share links (including canva.link → design/edit).
 */

export type LinkProvider = "google" | "canva";

export type LinkAccess = "public" | "private" | "unknown" | "unsupported";

export type ClassifiedLink =
  | {
      provider: "google";
      fileId: string;
      kind: "document" | "spreadsheets" | "presentation" | "file";
      probeUrls: string[];
    }
  | {
      provider: "canva";
      designId?: string;
      probeUrls: string[];
      isShortLink: boolean;
    }
  | {
      provider: null;
    };

const GOOGLE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;
const CANVA_DESIGN_ID_RE = /^[a-zA-Z0-9_-]{6,}$/;

export function hostnameOf(url: URL): string {
  return url.hostname.toLowerCase();
}

export function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function isIpv4Literal(hostname: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

/** Block SSRF-ish redirect targets while following Location headers. */
export function isUnsafeHostname(hostnameRaw: string) {
  const hostname = hostnameRaw.toLowerCase();

  if (!hostname) return true;
  if (hostname === "localhost") return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname.endsWith(".internal")) return true;
  if (hostname.endsWith(".localhost")) return true;
  if (isIpv4Literal(hostname)) return true;
  if (hostname.includes(":")) return true; // IPv6 literal

  return false;
}

export function hostHelpKind(hostname: string): LinkProvider | undefined {
  const h = hostname.toLowerCase();
  const bare = stripWww(h);

  const isGoogle =
    bare === "docs.google.com" ||
    bare === "drive.google.com" ||
    bare === "classroom.google.com" ||
    bare.endsWith(".google.com") ||
    bare.endsWith(".googleusercontent.com");
  if (isGoogle) return "google";

  const isCanva =
    bare === "canva.com" ||
    bare.endsWith(".canva.com") ||
    bare === "canva.link" ||
    bare.endsWith(".canva.link");
  if (isCanva) return "canva";

  return undefined;
}

export function isCanvaLoginPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path === "/login" || path === "/login/" || path.startsWith("/login/");
}

export function isCanvaDesignPath(pathname: string): boolean {
  return pathname.toLowerCase().startsWith("/design/");
}

function firstPathSegmentMatch(pathname: string, pattern: RegExp): RegExpMatchArray | null {
  return pathname.match(pattern);
}

export function classifyLinkUrl(rawUrl: string): ClassifiedLink {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { provider: null };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { provider: null };
  }

  const host = stripWww(hostnameOf(url));

  if (host === "docs.google.com") {
    const match = firstPathSegmentMatch(
      url.pathname,
      /^\/(document|spreadsheets|presentation)\/d\/([^/]+)/,
    );
    if (!match) return { provider: null };
    const kind = match[1] as "document" | "spreadsheets" | "presentation";
    const fileId = match[2];
    if (!GOOGLE_ID_RE.test(fileId)) return { provider: null };
    return {
      provider: "google",
      fileId,
      kind,
      probeUrls: googleProbeUrls(fileId, kind),
    };
  }

  if (host === "drive.google.com") {
    const fileMatch = firstPathSegmentMatch(url.pathname, /^\/file\/d\/([^/]+)/);
    const openId = url.searchParams.get("id");
    const fileId = fileMatch?.[1] ?? openId;
    if (!fileId || !GOOGLE_ID_RE.test(fileId)) return { provider: null };
    return {
      provider: "google",
      fileId,
      kind: "file",
      probeUrls: googleProbeUrls(fileId, "file"),
    };
  }

  if (host === "canva.link" || host.endsWith(".canva.link")) {
    return {
      provider: "canva",
      probeUrls: [url.toString()],
      isShortLink: true,
    };
  }

  if (host === "canva.com" || host.endsWith(".canva.com")) {
    const match = firstPathSegmentMatch(url.pathname, /^\/design\/([^/]+)/);
    if (!match) return { provider: null };
    const designId = match[1];
    if (!CANVA_DESIGN_ID_RE.test(designId)) return { provider: null };
    return {
      provider: "canva",
      designId,
      probeUrls: canvaProbeUrls(url, designId),
      isShortLink: false,
    };
  }

  return { provider: null };
}

export function needsPublicAccessCheck(rawUrl: string): boolean {
  return classifyLinkUrl(rawUrl).provider !== null;
}

function googleProbeUrls(
  fileId: string,
  kind: "document" | "spreadsheets" | "presentation" | "file",
): string[] {
  const urls: string[] = [`https://drive.google.com/file/d/${fileId}/view`];
  if (kind === "document") {
    urls.unshift(`https://docs.google.com/document/d/${fileId}/preview`);
    urls.push(`https://docs.google.com/document/d/${fileId}/export?format=txt`);
  } else if (kind === "spreadsheets") {
    urls.unshift(`https://docs.google.com/spreadsheets/d/${fileId}/preview`);
    urls.push(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`);
  } else if (kind === "presentation") {
    urls.unshift(`https://docs.google.com/presentation/d/${fileId}/preview`);
  }
  return urls;
}

function canvaProbeUrls(original: URL, designId: string): string[] {
  const host = original.host.toLowerCase().startsWith("www.")
    ? original.host
    : `www.${stripWww(original.host)}`;
  return [
    `${original.origin}${original.pathname}${original.search}`,
    `https://${host}/design/${designId}/view`,
  ].filter((value, index, all) => all.indexOf(value) === index);
}

/** Resolve canva.link HTML that redirects client-side to a design URL. */
export function extractCanvaDesignUrlFromHtml(html: string): string | undefined {
  const metaRefresh = /http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)["']/i.exec(
    html,
  );
  const metaUrl = metaRefresh?.[1];
  if (metaUrl?.startsWith("https://")) return metaUrl;

  const canonical = /rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  const canonicalUrl = canonical?.[1];
  if (canonicalUrl?.startsWith("https://")) return canonicalUrl;

  const ogUrl = /property=["']og:url["'][^>]*content=["']([^"']+)["']/i.exec(html);
  const og = ogUrl?.[1];
  if (og?.startsWith("https://")) return og;

  const scan =
    /https:\/\/(?:www\.)?canva\.com\/design\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(?:\/(?:edit|view))?[^\s"'<>]*/.exec(
      html,
    );
  return scan?.[0];
}

/**
 * Detect Google/Canva "not shared for anyone with the link" walls.
 * Canva private share links redirect to /login/ — that path is the reliable signal.
 */
export function looksLikeSharingWall(
  hostname: string,
  finalUrl: string,
  _originalUrl: string,
  snippetLower: string,
): { needsSharing: boolean; help?: LinkProvider } {
  const help = hostHelpKind(hostname);

  let final: URL | null = null;
  try {
    final = new URL(finalUrl);
  } catch {
    // keep null for invalid URLs
  }
  const finalHost = final?.hostname.toLowerCase() ?? "";
  const finalPath = final?.pathname.toLowerCase() ?? "";

  if (
    finalHost === "accounts.google.com" ||
    finalHost.endsWith(".accounts.google.com") ||
    finalHost === "login.canva.com" ||
    (finalHost.endsWith(".canva.com") && finalHost.includes("login"))
  ) {
    return { needsSharing: true, help };
  }

  if (
    (finalHost === "canva.com" || finalHost.endsWith(".canva.com")) &&
    isCanvaLoginPath(finalPath)
  ) {
    return { needsSharing: true, help: "canva" };
  }

  if (help === "google") {
    const googlePhrases = [
      "you need permission",
      "you need access",
      "request access",
      "access denied",
      "sign in to continue",
      "to continue to google",
      "this file is in the owner's trash",
      "ask for access",
    ];
    if (googlePhrases.some((p) => snippetLower.includes(p))) {
      return { needsSharing: true, help: "google" };
    }
  }

  // Canva: do not use broad HTML phrases ("sign up", "continue with google", etc.) —
  // public share pages and bot "Unsupported client" shells trip those. Rely on /login/.

  return { needsSharing: false };
}

/** Canva access from final URL after redirect walking (local/Hono-like environments). */
export function interpretCanvaFinalUrl(finalUrl: string): LinkAccess {
  let parsed: URL;
  try {
    parsed = new URL(finalUrl);
  } catch {
    return "unknown";
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const help = hostHelpKind(host);

  if (help !== "canva") {
    return "unknown";
  }

  if (host === "login.canva.com" || (host.endsWith(".canva.com") && host.includes("login"))) {
    return "private";
  }

  if (isCanvaLoginPath(path)) {
    return "private";
  }

  // Only treat /design/ as public when we did not hit a bot wall — callers should prefer
  // interpretCanvaOembedResponse from Convex, where design HTML is Cloudflare-blocked.
  if (isCanvaDesignPath(path)) {
    return "public";
  }

  return "unknown";
}

/**
 * Canva `_oembed` works from Convex IPs:
 * - public share → 200 JSON with html/thumbnail
 * - private share → 401
 */
export function interpretCanvaOembedResponse(args: {
  status: number;
  json: unknown;
  finalUrl: string;
}): LinkAccess {
  if (args.status === 401 || args.status === 403 || args.status === 404) {
    return "private";
  }

  if (args.status >= 200 && args.status < 300 && args.json && typeof args.json === "object") {
    const record = args.json as Record<string, unknown>;
    if (
      typeof record.html === "string" ||
      typeof record.thumbnail_url === "string" ||
      record.type === "rich" ||
      record.type === "photo" ||
      record.type === "video" ||
      record.type === "link"
    ) {
      return "public";
    }
  }

  // If oembed somehow redirected to login, treat as private.
  try {
    const final = new URL(args.finalUrl);
    if (isCanvaLoginPath(final.pathname)) {
      return "private";
    }
  } catch {
    // ignore
  }

  return "unknown";
}

export function interpretProbePage(args: {
  provider: LinkProvider;
  finalUrl: string;
  originalUrl: string;
  status: number;
  bodySnippet: string;
}): LinkAccess {
  if (args.provider === "canva") {
    const hostname = (() => {
      try {
        return new URL(args.finalUrl).hostname;
      } catch {
        return "";
      }
    })();
    const wall = looksLikeSharingWall(
      hostname,
      args.finalUrl,
      args.originalUrl,
      args.bodySnippet.toLowerCase(),
    );
    if (wall.needsSharing) return "private";

    // Fallback path only: require login-wall absence AND a successful response.
    // Do not treat Cloudflare 403 on /design/ as public (Convex datacenter IPs).
    if (args.status >= 200 && args.status < 300) {
      return interpretCanvaFinalUrl(args.finalUrl);
    }
    return "unknown";
  }

  const hostname = (() => {
    try {
      return new URL(args.finalUrl).hostname;
    } catch {
      return "";
    }
  })();
  const snippetLower = args.bodySnippet.toLowerCase();

  const wall = looksLikeSharingWall(hostname, args.finalUrl, args.originalUrl, snippetLower);
  if (wall.needsSharing) {
    return "private";
  }

  if (args.status === 401 || args.status === 403) {
    return "private";
  }

  const haystack = `${args.finalUrl}\n${snippetLower}`;
  const publicMarkers = [
    "docs-gm",
    "google-docs",
    "drive-viewer",
    "spreadsheets-page",
    "punch-start",
    "exportsession",
  ];
  if (args.status >= 200 && args.status < 300) {
    if (publicMarkers.some((marker) => haystack.includes(marker))) {
      return "public";
    }
    if (
      args.finalUrl.includes("/export") &&
      args.bodySnippet.trim().length > 0 &&
      !snippetLower.includes("<html")
    ) {
      return "public";
    }
    if (args.finalUrl.includes("/preview") || args.finalUrl.includes("/view")) {
      return "public";
    }
  }
  return "unknown";
}

export function mergeAccessResults(results: LinkAccess[]): LinkAccess {
  // Prefer private over public — a single private probe must block submit.
  if (results.includes("private")) return "private";
  if (results.includes("public")) return "public";
  if (results.length === 0) return "unsupported";
  return "unknown";
}
