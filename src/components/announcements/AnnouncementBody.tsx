import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";

import { announcementBodyClassName } from "@/components/announcements/announcementBodyStyles";
import { useExternalLinkIcons } from "@/components/announcements/useExternalLinkIcons";
import {
  createAnnouncementExtensions,
  parseAnnouncementBodyJson,
} from "@/lib/announcements/tiptapExtensions";
import { cn } from "@/lib/utils";

type AnnouncementBodyProps = {
  bodyJson: string;
  className?: string;
};

export function AnnouncementBody({ bodyJson, className }: AnnouncementBodyProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createAnnouncementExtensions({ editable: false }),
    content: parseAnnouncementBodyJson(bodyJson),
    editable: false,
    editorProps: {
      attributes: {
        class: announcementBodyClassName(),
      },
    },
  });

  useExternalLinkIcons(editor);

  useEffect(() => {
    if (!editor) return;
    const next = parseAnnouncementBodyJson(bodyJson);
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(next)) {
      editor.commands.setContent(next);
    }
  }, [bodyJson, editor]);

  return (
    <div className={cn("announcement-body-root", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
