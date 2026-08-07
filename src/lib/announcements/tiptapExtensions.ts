import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions, JSONContent } from "@tiptap/react";

export const EMPTY_ANNOUNCEMENT_BODY: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const EMPTY_ANNOUNCEMENT_BODY_JSON = JSON.stringify(EMPTY_ANNOUNCEMENT_BODY);

export function createAnnouncementExtensions(options?: {
  placeholder?: string;
  editable?: boolean;
}): Extensions {
  const editable = options?.editable !== false;
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: {
        openOnClick: !editable,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
          class: "announcement-link text-primary underline underline-offset-2",
        },
      },
    }),
    ...(editable && options?.placeholder
      ? [
          Placeholder.configure({
            placeholder: options.placeholder,
          }),
        ]
      : []),
  ];
}

export function parseAnnouncementBodyJson(bodyJson: string): JSONContent {
  try {
    const parsed: unknown = JSON.parse(bodyJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_ANNOUNCEMENT_BODY;
    }
    const doc = parsed as { type?: unknown };
    if (doc.type !== "doc") {
      return EMPTY_ANNOUNCEMENT_BODY;
    }
    return parsed as JSONContent;
  } catch {
    return EMPTY_ANNOUNCEMENT_BODY;
  }
}
