import { Download, FileText, ImageIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export type AttachmentItem = {
  fileId: Id<"files">;
  name: string;
  contentType: string;
  size: number;
  preset?: string;
  /** Present on public pages (signed storage URL). */
  url?: string | null;
};

type AttachmentListProps = {
  attachments: Array<AttachmentItem>;
  onRemove?: (fileId: Id<"files">) => void;
  canDownload?: boolean;
  className?: string;
};

export function AttachmentList({
  attachments,
  onRemove,
  canDownload = true,
  className,
}: AttachmentListProps) {
  if (attachments.length === 0) return null;
  return (
    <ul
      className={cn(
        "grid w-full gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]",
        className,
      )}
    >
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.fileId}
          attachment={attachment}
          onRemove={onRemove}
          canDownload={canDownload}
        />
      ))}
    </ul>
  );
}

function AttachmentCard({
  attachment,
  onRemove,
  canDownload,
}: {
  attachment: AttachmentItem;
  onRemove?: (fileId: Id<"files">) => void;
  canDownload: boolean;
}) {
  const { t } = useTranslation("upload");
  const isImage = attachment.preset === "images" || attachment.contentType.startsWith("image/");
  const authed = useFileBytes(attachment.url === undefined ? attachment.fileId : undefined);
  const href = attachment.url ?? authed.url;
  const previewUrl = isImage ? href : null;
  const name = attachment.name || t("unnamedAttachment");
  const sizeLabel = formatBytes(attachment.size);

  return (
    <li>
      <Card
        size="sm"
        className="h-full flex-row items-center gap-3 overflow-hidden px-(--card-spacing)"
      >
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt={name} className="size-full object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-lg bg-background/70 text-muted-foreground ring-1 ring-foreground/10">
              {isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm font-medium" title={name}>
            {name}
          </CardTitle>
          {sizeLabel ? <p className="text-xs text-muted-foreground">{sizeLabel}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canDownload && href ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              render={
                <a
                  href={href}
                  download={attachment.name || undefined}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              aria-label={t("downloadAttachment")}
            >
              <Download className="size-4" />
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeAttachment")}
              onClick={() => onRemove(attachment.fileId)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
