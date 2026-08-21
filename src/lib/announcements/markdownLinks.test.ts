import { describe, expect, test } from "vite-plus/test";
import type { JSONContent } from "@tiptap/react";

import {
  convertMarkdownLinksInDoc,
  normalizeMarkdownHref,
} from "@/lib/announcements/markdownLinks";
import { parseAnnouncementBodyJson } from "@/lib/announcements/tiptapExtensions";

function paragraphDoc(text: string, marks?: JSONContent["marks"]): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [marks ? { type: "text", text, marks } : { type: "text", text }],
      },
    ],
  };
}

function paragraphContent(doc: JSONContent): JSONContent[] {
  const paragraph = doc.content?.[0];
  return paragraph?.content ?? [];
}

function linkHref(node: JSONContent | undefined): string | undefined {
  const mark = node?.marks?.find((item) => item.type === "link");
  const href = mark?.attrs?.href;
  return typeof href === "string" ? href : undefined;
}

describe("normalizeMarkdownHref", () => {
  test("allows http, https, and mailto", () => {
    expect(normalizeMarkdownHref("https://example.com")).toBe("https://example.com");
    expect(normalizeMarkdownHref("http://example.com")).toBe("http://example.com");
    expect(normalizeMarkdownHref("mailto:teacher@example.com")).toBe("mailto:teacher@example.com");
  });

  test("adds https when the protocol is missing", () => {
    expect(normalizeMarkdownHref("example.com/portal")).toBe("https://example.com/portal");
  });

  test("rejects javascript and other protocols", () => {
    expect(normalizeMarkdownHref("javascript:alert(1)")).toBeNull();
    expect(normalizeMarkdownHref("data:text/html,hi")).toBeNull();
  });
});

describe("convertMarkdownLinksInDoc", () => {
  test("converts [School portal](https://example.com) into a link mark", () => {
    const doc = convertMarkdownLinksInDoc(paragraphDoc("[School portal](https://example.com)"));
    const nodes = paragraphContent(doc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.text).toBe("School portal");
    expect(linkHref(nodes[0])).toBe("https://example.com");
  });

  test("keeps mixed text around the link", () => {
    const doc = convertMarkdownLinksInDoc(
      paragraphDoc("See [School portal](https://example.com) today."),
    );
    const nodes = paragraphContent(doc);
    expect(nodes.map((node) => node.text)).toEqual(["See ", "School portal", " today."]);
    expect(linkHref(nodes[0])).toBeUndefined();
    expect(linkHref(nodes[1])).toBe("https://example.com");
    expect(linkHref(nodes[2])).toBeUndefined();
  });

  test("allows mailto links", () => {
    const doc = convertMarkdownLinksInDoc(paragraphDoc("[Email me](mailto:teacher@example.com)"));
    expect(linkHref(paragraphContent(doc)[0])).toBe("mailto:teacher@example.com");
  });

  test("skips javascript URLs", () => {
    const original = paragraphDoc("[Nope](javascript:alert(1))");
    const doc = convertMarkdownLinksInDoc(original);
    const nodes = paragraphContent(doc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.text).toBe("[Nope](javascript:alert(1))");
    expect(linkHref(nodes[0])).toBeUndefined();
  });

  test("skips image markdown", () => {
    const original = paragraphDoc("![badge](https://example.com/badge.png)");
    const doc = convertMarkdownLinksInDoc(original);
    const nodes = paragraphContent(doc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.text).toBe("![badge](https://example.com/badge.png)");
    expect(linkHref(nodes[0])).toBeUndefined();
  });

  test("leaves already-linked text unchanged", () => {
    const original = paragraphDoc("School portal", [
      { type: "link", attrs: { href: "https://already.example" } },
    ]);
    const doc = convertMarkdownLinksInDoc(original);
    const nodes = paragraphContent(doc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.text).toBe("School portal");
    expect(linkHref(nodes[0])).toBe("https://already.example");
  });

  test("does not wrap text that is already a markdown string inside a link mark", () => {
    const original = paragraphDoc("[School portal](https://example.com)", [
      { type: "link", attrs: { href: "https://already.example" } },
    ]);
    const doc = convertMarkdownLinksInDoc(original);
    const nodes = paragraphContent(doc);
    expect(nodes[0]?.text).toBe("[School portal](https://example.com)");
    expect(linkHref(nodes[0])).toBe("https://already.example");
  });
});

describe("parseAnnouncementBodyJson", () => {
  test("converts stored markdown links", () => {
    const doc = parseAnnouncementBodyJson(
      JSON.stringify(paragraphDoc("Open [the portal](https://school.example/home).")),
    );
    const nodes = paragraphContent(doc);
    expect(nodes.map((node) => node.text)).toEqual(["Open ", "the portal", "."]);
    expect(linkHref(nodes[1])).toBe("https://school.example/home");
  });
});
