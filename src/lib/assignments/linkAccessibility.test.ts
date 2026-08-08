import { describe, expect, test } from "vite-plus/test";

import {
  classifyLinkUrl,
  interpretCanvaFinalUrl,
  interpretCanvaOembedResponse,
  interpretProbePage,
  looksLikeSharingWall,
  mergeAccessResults,
  needsPublicAccessCheck,
} from "../../../convex/lib/linkAccessibility";

describe("classifyLinkUrl", () => {
  test("classifies Canva short links", () => {
    expect(classifyLinkUrl("https://www.canva.link/abc123")).toMatchObject({
      provider: "canva",
      isShortLink: true,
    });
    expect(needsPublicAccessCheck("https://canva.link/4zl4wfrik8l7fsp")).toBe(true);
  });
});

describe("interpretCanvaOembedResponse", () => {
  test("200 rich JSON is public", () => {
    expect(
      interpretCanvaOembedResponse({
        status: 200,
        finalUrl: "https://www.canva.com/_oembed?url=...",
        json: {
          type: "rich",
          title: "Cavna Public Share",
          html: '<iframe src="https://www.canva.com/design/x/view?embed"></iframe>',
          thumbnail_url: "https://www.canva.com/design/x/screen?type=thumbnail",
        },
      }),
    ).toBe("public");
  });

  test("401/403/404 are private", () => {
    expect(
      interpretCanvaOembedResponse({
        status: 401,
        finalUrl: "https://www.canva.com/_oembed?url=...",
        json: null,
      }),
    ).toBe("private");
    expect(
      interpretCanvaOembedResponse({
        status: 403,
        finalUrl: "https://www.canva.com/_oembed?url=...",
        json: null,
      }),
    ).toBe("private");
  });
});

describe("interpretCanvaFinalUrl", () => {
  test("login path is private", () => {
    expect(
      interpretCanvaFinalUrl("https://www.canva.com/login/?redirect=%2Fdesign%2Fx%2Fview"),
    ).toBe("private");
  });
});

describe("interpretProbePage canva fallback", () => {
  test("does not treat design+403 as public", () => {
    expect(
      interpretProbePage({
        provider: "canva",
        finalUrl: "https://www.canva.com/design/DAHJEoqUk4w/qggQyOqFRhe4t25l2MlYYw/edit",
        originalUrl: "https://canva.link/4zl4wfrik8l7fsp",
        status: 403,
        bodySnippet: "Canva",
      }),
    ).toBe("unknown");
  });

  test("login wall still private", () => {
    expect(
      looksLikeSharingWall(
        "www.canva.com",
        "https://www.canva.com/login/?redirect=%2Fdesign%2Fx",
        "https://canva.link/x",
        "",
      ),
    ).toEqual({ needsSharing: true, help: "canva" });
  });
});

describe("mergeAccessResults", () => {
  test("prefers private over public", () => {
    expect(mergeAccessResults(["public", "private"])).toBe("private");
  });
});
