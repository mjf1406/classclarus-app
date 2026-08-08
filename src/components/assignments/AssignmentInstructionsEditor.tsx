import { useEditor, EditorContent } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { announcementBodyClassName } from "@/components/announcements/announcementBodyStyles";
import { useExternalLinkIcons } from "@/components/announcements/useExternalLinkIcons";
import { Button } from "@/components/ui/button";
import {
  createAnnouncementExtensions,
  EMPTY_ANNOUNCEMENT_BODY_JSON,
  parseAnnouncementBodyJson,
} from "@/lib/announcements/tiptapExtensions";
import { cn } from "@/lib/utils";

type AssignmentInstructionsEditorProps = {
  value: string;
  onChange: (bodyJson: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AssignmentInstructionsEditor({
  value,
  onChange,
  disabled = false,
  className,
}: AssignmentInstructionsEditorProps) {
  const { t } = useTranslation("assignments");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createAnnouncementExtensions({
      editable: true,
      placeholder: t("instructionsPlaceholder"),
    }),
    content: parseAnnouncementBodyJson(value || EMPTY_ANNOUNCEMENT_BODY_JSON),
    editable: !disabled,
    onUpdate: ({ editor: current }) => {
      onChange(JSON.stringify(current.getJSON()));
    },
    editorProps: {
      attributes: {
        class: announcementBodyClassName("min-h-40 px-3 py-2 focus:outline-none"),
      },
    },
  });

  useExternalLinkIcons(editor);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextJson = value || EMPTY_ANNOUNCEMENT_BODY_JSON;
    const current = JSON.stringify(editor.getJSON());
    if (current === nextJson) return;
    const next = parseAnnouncementBodyJson(nextJson);
    if (JSON.stringify(next) !== current) {
      editor.commands.setContent(next);
    }
  }, [value, editor]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("linkPrompt"), previous ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  if (!editor) {
    return (
      <div className={cn("min-h-52 rounded-lg border border-input bg-background", className)} />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
        <ToolbarButton
          label={t("toolbarBold")}
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarItalic")}
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarUnderline")}
          active={editor.isActive("underline")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarHeading2")}
          active={editor.isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarHeading3")}
          active={editor.isActive("heading", { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarBulletList")}
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarOrderedList")}
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("toolbarLink")}
          active={editor.isActive("link")}
          disabled={disabled}
          onClick={setLink}
        >
          <Link2 className="size-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(active && "bg-muted")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
