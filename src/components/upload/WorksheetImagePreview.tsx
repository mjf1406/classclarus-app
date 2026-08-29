import { useState } from "react";
import { Download, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [viewerOpen, setViewerOpen] = useState(false);
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
    <>
      <Card size="sm" className="flex-row items-center gap-3 overflow-hidden px-(--card-spacing)">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {isPending ? (
            <Skeleton className="size-full" />
          ) : url ? (
            <button
              type="button"
              className="size-full cursor-zoom-in"
              onClick={() => setViewerOpen(true)}
              aria-label={openLabel}
            >
              <img src={url} alt={alt} className="size-full object-cover" />
            </button>
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

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          className="flex h-dvh max-h-dvh w-screen max-w-none flex-col items-center justify-center rounded-none p-4 sm:max-w-none"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title ?? alt}</DialogTitle>
          </DialogHeader>
          {url ? (
            <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
