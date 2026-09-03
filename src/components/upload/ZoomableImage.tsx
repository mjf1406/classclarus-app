import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImageZoomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null | undefined;
  alt: string;
};

export function ImageZoomDialog({ open, onOpenChange, src, alt }: ImageZoomDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col items-center justify-center rounded-none p-4 sm:max-w-none"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        {src ? <img src={src} alt={alt} className="max-h-full max-w-full object-contain" /> : null}
      </DialogContent>
    </Dialog>
  );
}

type ZoomableImageProps = {
  src: string;
  alt: string;
  expandLabel?: string;
  className?: string;
  imgClassName?: string;
};

export function ZoomableImage({
  src,
  alt,
  expandLabel,
  className,
  imgClassName,
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn("size-full cursor-zoom-in", className)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={expandLabel ?? alt}
      >
        <img src={src} alt={alt} className={cn("size-full object-cover", imgClassName)} />
      </button>
      <ImageZoomDialog open={open} onOpenChange={setOpen} src={src} alt={alt} />
    </>
  );
}
