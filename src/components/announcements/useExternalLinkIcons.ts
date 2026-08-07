import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

const EXTERNAL_ICON_ATTR = "data-external-link-icon";

/** Inject a small external-link SVG after each hyperlink in the TipTap DOM. */
export function useExternalLinkIcons(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    const syncIcons = () => {
      const root = editor.view.dom;
      const links = root.querySelectorAll<HTMLAnchorElement>("a[href]");
      for (const link of links) {
        if (link.querySelector(`[${EXTERNAL_ICON_ATTR}]`)) continue;
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        const icon = document.createElement("span");
        icon.setAttribute(EXTERNAL_ICON_ATTR, "");
        icon.setAttribute("aria-hidden", "true");
        icon.className = "inline-flex size-3.5 shrink-0 text-muted-foreground";
        icon.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
        link.appendChild(icon);
      }
    };

    syncIcons();
    editor.on("update", syncIcons);
    editor.on("selectionUpdate", syncIcons);
    return () => {
      editor.off("update", syncIcons);
      editor.off("selectionUpdate", syncIcons);
    };
  }, [editor]);
}
