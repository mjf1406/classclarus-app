import type { JSONContent } from "@tiptap/react";

export const ANNOUNCEMENT_LINK_HTML_ATTRIBUTES = {
  target: "_blank",
  rel: "noopener noreferrer",
  class: "announcement-link text-primary underline underline-offset-2",
} as const;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Markdown link with optional quoted title. URL may contain one level of
 * balanced parentheses (CommonMark). Image syntax `![alt](url)` is not matched
 * here; callers skip a match when the previous character is `!`.
 */
const MARKDOWN_LINK_GLOBAL =
  /\[([^[\]]+)\]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:(["'])(.*?)\3|“(.*?)”|‘(.*?)’))?\)/g;

type LinkMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

function hasLinkMark(marks: JSONContent["marks"] | undefined): boolean {
  return marks?.some((mark) => mark.type === "link") ?? false;
}

export function normalizeMarkdownHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return withProtocol;
  } catch {
    return null;
  }
}

function textNode(text: string, marks: JSONContent["marks"] | undefined): JSONContent {
  if (marks && marks.length > 0) {
    return { type: "text", text, marks };
  }
  return { type: "text", text };
}

function linkMarks(
  existing: JSONContent["marks"] | undefined,
  href: string,
  title: string | null,
): LinkMark[] {
  const next: LinkMark[] = existing
    ? existing.map((mark) => ({ type: mark.type, attrs: mark.attrs }))
    : [];
  next.push({
    type: "link",
    attrs: {
      href,
      ...ANNOUNCEMENT_LINK_HTML_ATTRIBUTES,
      title,
    },
  });
  return next;
}

function splitTextNodeOnMarkdownLinks(node: JSONContent): JSONContent[] {
  const text = node.text;
  if (typeof text !== "string" || text.length === 0) {
    return [node];
  }
  if (hasLinkMark(node.marks)) {
    return [node];
  }

  const parts: JSONContent[] = [];
  let lastIndex = 0;
  const regex = new RegExp(MARKDOWN_LINK_GLOBAL.source, "g");

  for (const match of text.matchAll(regex)) {
    const index = match.index;
    if (index === undefined) continue;

    if (index > 0) {
      const previous = text[index - 1];
      if (previous === "!" || previous === "\\") {
        continue;
      }
    }

    const href = normalizeMarkdownHref(match[2] ?? "");
    if (!href) continue;

    const title = match[4] ?? match[5] ?? match[6] ?? null;
    const label = match[1] ?? "";
    if (label.length === 0) continue;

    if (index > lastIndex) {
      parts.push(textNode(text.slice(lastIndex, index), node.marks));
    }
    parts.push(textNode(label, linkMarks(node.marks, href, title || null)));
    lastIndex = index + match[0].length;
  }

  if (lastIndex === 0) {
    return [node];
  }
  if (lastIndex < text.length) {
    parts.push(textNode(text.slice(lastIndex), node.marks));
  }
  return parts.length > 0 ? parts : [node];
}

export function convertMarkdownLinksInDoc(doc: JSONContent): JSONContent {
  return convertNode(doc);
}

function convertNode(node: JSONContent): JSONContent {
  if (!node.content) {
    return node;
  }
  const nextContent: JSONContent[] = [];
  for (const child of node.content) {
    if (child.type === "text") {
      nextContent.push(...splitTextNodeOnMarkdownLinks(child));
    } else {
      nextContent.push(convertNode(child));
    }
  }
  return { ...node, content: nextContent };
}
