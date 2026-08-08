"use node";

import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import { action } from "./_generated/server.js";
import {
  classifyLinkUrl,
  interpretCanvaOembedResponse,
  interpretProbePage,
  isUnsafeHostname,
  mergeAccessResults,
  stripWww,
  type LinkAccess,
  type LinkProvider,
} from "./lib/linkAccessibility.js";

const MAX_BODY_CHARS = 64 * 1024;
const FETCH_TIMEOUT_MS = 9_000;
const MAX_REDIRECTS = 8;

const accessValidator = v.union(
  v.literal("public"),
  v.literal("private"),
  v.literal("unknown"),
  v.literal("unsupported"),
);

const providerValidator = v.union(v.literal("google"), v.literal("canva"), v.null());

const CHECKER_UA = "ClassClarusLinkChecker/1.0 (+https://classclarus.app)";

function isCanvaShortHost(hostname: string): boolean {
  const bare = stripWww(hostname.toLowerCase());
  return bare === "canva.link" || bare.endsWith(".canva.link");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRedirects(
  inputUrl: URL,
  opts: {
    method: "HEAD" | "GET";
    maxRedirects: number;
    timeoutMs: number;
    rangeBytes?: number;
  },
): Promise<{
  response: Response;
  finalUrl: string;
  finalHostname: string;
}> {
  let current = new URL(inputUrl.toString());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    for (let i = 0; i <= opts.maxRedirects; i++) {
      const headers: Record<string, string> = {
        "User-Agent": CHECKER_UA,
        Accept:
          opts.method === "HEAD"
            ? "*/*"
            : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      };
      if (opts.method === "GET" && opts.rangeBytes) {
        headers.Range = `bytes=0-${Math.max(0, opts.rangeBytes - 1)}`;
      }

      const res = await fetch(current.toString(), {
        method: opts.method,
        redirect: "manual",
        headers,
        signal: controller.signal,
      });

      const status = res.status;
      const isRedirect =
        status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

      if (!isRedirect) {
        return {
          response: res,
          finalUrl: current.toString(),
          finalHostname: current.hostname,
        };
      }

      const location = res.headers.get("location");
      if (!location) {
        return {
          response: res,
          finalUrl: current.toString(),
          finalHostname: current.hostname,
        };
      }

      const next = new URL(location, current);
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new Error("Redirected to unsupported protocol");
      }
      if (isUnsafeHostname(next.hostname)) {
        throw new Error("Redirected to unsafe host");
      }
      current = next;
    }

    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve canva.link → canonical design URL via the 301 Location (works from Convex). */
async function resolveCanvaDesignUrl(rawUrl: string): Promise<string> {
  const start = new URL(rawUrl);
  if (!isCanvaShortHost(start.hostname)) {
    return start.toString();
  }

  const res = await fetchWithTimeout(
    start.toString(),
    {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": CHECKER_UA,
        Accept: "*/*",
      },
    },
    FETCH_TIMEOUT_MS,
  );

  const location = res.headers.get("location");
  if (!location) {
    return start.toString();
  }
  const next = new URL(location, start);
  if (isUnsafeHostname(next.hostname)) {
    throw new Error("Redirected to unsafe host");
  }
  return next.toString();
}

/**
 * Canva blocks design HTML from Convex IPs (Cloudflare 403), so /login redirects are
 * invisible. `_oembed` still returns 200 JSON for public shares and 401 for private.
 */
async function probeCanvaOembed(designUrl: string): Promise<LinkAccess> {
  const oembedUrl = `https://www.canva.com/_oembed?url=${encodeURIComponent(designUrl)}`;
  const res = await fetchWithTimeout(
    oembedUrl,
    {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": CHECKER_UA,
        Accept: "application/json,*/*",
      },
    },
    FETCH_TIMEOUT_MS,
  );

  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    // keep empty on read failure
  }

  let json: unknown = null;
  if (bodyText) {
    try {
      json = JSON.parse(bodyText);
    } catch {
      json = null;
    }
  }

  return interpretCanvaOembedResponse({
    status: res.status,
    json,
    finalUrl: res.url || oembedUrl,
  });
}

async function probeCanvaOnce(probeUrl: string): Promise<LinkAccess> {
  const designUrl = await resolveCanvaDesignUrl(probeUrl);
  const oembedAccess = await probeCanvaOembed(designUrl);
  if (oembedAccess === "public" || oembedAccess === "private") {
    return oembedAccess;
  }

  // Fallback: walk a /view URL for environments that still expose /login redirects.
  const viewUrl = designUrl.replace("/edit?", "/view?").replace(/\/edit(\?|$)/, "/view$1");
  const page = await fetchWithRedirects(new URL(viewUrl), {
    method: "GET",
    maxRedirects: MAX_REDIRECTS,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  return interpretProbePage({
    provider: "canva",
    finalUrl: page.finalUrl,
    originalUrl: probeUrl,
    status: page.response.status,
    bodySnippet: "",
  });
}

async function probeCanva(probeUrls: string[]): Promise<LinkAccess> {
  const results: LinkAccess[] = [];
  for (const probeUrl of probeUrls) {
    try {
      const access = await probeCanvaOnce(probeUrl);
      results.push(access);
      if (access === "public" || access === "private") break;
    } catch {
      results.push("unknown");
    }
  }
  return mergeAccessResults(results);
}

async function getGoogleSnippet(url: URL): Promise<{
  status: number;
  finalUrl: string;
  finalHostname: string;
  bodySnippet: string;
}> {
  const head = await fetchWithRedirects(url, {
    method: "HEAD",
    maxRedirects: MAX_REDIRECTS,
    timeoutMs: FETCH_TIMEOUT_MS,
  });

  const shouldGet =
    head.response.ok || head.response.status === 405 || head.response.status === 403;

  if (!shouldGet) {
    return {
      status: head.response.status,
      finalUrl: head.finalUrl,
      finalHostname: head.finalHostname,
      bodySnippet: "",
    };
  }

  const get = await fetchWithRedirects(url, {
    method: "GET",
    maxRedirects: MAX_REDIRECTS,
    timeoutMs: FETCH_TIMEOUT_MS,
    rangeBytes: MAX_BODY_CHARS,
  });

  let bodySnippet = "";
  if (get.response.ok || get.response.status === 206) {
    bodySnippet = (await get.response.text()).slice(0, MAX_BODY_CHARS);
  }

  return {
    status: get.response.status,
    finalUrl: get.finalUrl,
    finalHostname: get.finalHostname,
    bodySnippet,
  };
}

async function probeGoogle(probeUrls: string[]): Promise<LinkAccess> {
  const results: LinkAccess[] = [];
  for (const probeUrl of probeUrls) {
    try {
      const page = await getGoogleSnippet(new URL(probeUrl));
      const access = interpretProbePage({
        provider: "google",
        finalUrl: page.finalUrl,
        originalUrl: probeUrl,
        status: page.status,
        bodySnippet: page.bodySnippet,
      });
      results.push(access);
      if (access === "public" || access === "private") break;
    } catch {
      results.push("unknown");
    }
  }
  return mergeAccessResults(results);
}

/**
 * Best-effort check that a Google Docs/Sheets/Slides/Drive or Canva link is
 * viewable without signing in ("anyone with the link").
 */
export const checkPublicAccess = action({
  args: {
    url: v.string(),
  },
  returns: v.object({
    provider: providerValidator,
    access: accessValidator,
  }),
  handler: async (ctx, args): Promise<{ provider: LinkProvider | null; access: LinkAccess }> => {
    const user = (await ctx.runQuery(api.users.currentUser, {})) as Doc<"users"> | null;
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }

    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "assignmentLinkAccessCheck",
      key: user._id,
    });
    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "assignmentLinkAccessCheckGlobal",
      key: "global",
    });

    const classified = classifyLinkUrl(args.url);
    if (classified.provider === null) {
      return { provider: null, access: "unsupported" };
    }

    const access =
      classified.provider === "canva"
        ? await probeCanva(classified.probeUrls)
        : await probeGoogle(classified.probeUrls);

    return { provider: classified.provider, access };
  },
});
