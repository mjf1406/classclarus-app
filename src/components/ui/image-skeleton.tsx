import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ImageSkeletonProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  className?: string;
};

export function ImageSkeleton({
  src,
  alt,
  width,
  height,
  objectFit = "contain",
  className,
}: ImageSkeletonProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn("relative inline-block overflow-hidden", className)}
      style={{ width, height }}
    >
      {!loaded && !failed ? (
        <Skeleton className="absolute inset-0 size-full rounded-none" aria-hidden />
      ) : null}
      {!failed ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            "block size-full",
            objectFit === "contain" && "object-contain",
            objectFit === "cover" && "object-cover",
            objectFit === "fill" && "object-fill",
            objectFit === "none" && "object-none",
            objectFit === "scale-down" && "object-scale-down",
            !loaded && "opacity-0",
          )}
          onLoad={() => {
            setLoaded(true);
          }}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      ) : null}
    </div>
  );
}
