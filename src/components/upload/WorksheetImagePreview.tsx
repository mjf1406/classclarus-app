import { Download, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ZoomableImage } from "@/components/upload/ZoomableImage";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type WorksheetImagePreviewProps = {
  fileId: Id<"files">;
  alt: string;
  variant?: "form" | "detail";
  downloadLabel?: string;
  expandLabel?: string;
  title?: string;
  hint?: string;
  fileName?: string;
  canDownload?: boolean;
};

export function WorksheetImagePreview({
  fileId,
  alt,
  variant = "detail",
  downloadLabel,
  expandLabel,
  title,
  hint,
  fileName,
  canDownload = true,
}: WorksheetImagePreviewProps) {
  const { url, data, isPending, isError } = useFileBytes(fileId);
  const resolvedName = fileName ?? data?.name ?? alt;
  const openLabel = expandLabel ?? alt;

  if (variant === "form") {
    if (isPending) {
      return <Skeleton className="size-20 rounded-md" />;
    }
    if (isError || !url) {
      return (
        <div className="flex size-20 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ImageIcon />
        </div>
      );
    }
    return <img src={url} alt={alt} className="size-20 rounded-md object-cover" />;
  }

  return (
    <Card size="sm" className="flex-row items-center gap-3 overflow-hidden px-(--card-spacing)">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isPending ? (
          <Skeleton className="size-full" />
        ) : url ? (
          <ZoomableImage src={url} alt={alt} expandLabel={openLabel} />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-lg bg-background/70 text-muted-foreground ring-1 ring-foreground/10">
            <ImageIcon />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <CardTitle className={cn("truncate text-sm font-medium")} title={title ?? resolvedName}>
          {title ?? resolvedName}
        </CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {url && canDownload ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          render={<a href={url} download={resolvedName} target="_blank" rel="noreferrer" />}
          aria-label={downloadLabel ?? resolvedName}
        >
          <Download />
        </Button>
      ) : null}
    </Card>
  );
}
