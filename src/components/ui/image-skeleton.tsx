/** @format */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface ImageSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  height?: number | string;
  width?: number | string;
  skeletonClassName?: string;
  aspectRatio?: string;
}

const ImageSkeleton = React.forwardRef<HTMLImageElement, ImageSkeletonProps>(
  (
    {
      height,
      width,
      className,
      skeletonClassName,
      aspectRatio,
      src,
      alt,
      onLoad,
      onError,
      ...props
    },
    ref,
  ) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const imgRef = React.useRef<HTMLImageElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => imgRef.current!);

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoading(false);
      onLoad?.(e);
    };

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoading(false);
      setHasError(true);
      onError?.(e);
    };

    // After mount / src change: skip skeleton when the browser already has the image
    React.useLayoutEffect(() => {
      if (!src) {
        return;
      }
      setHasError(false);
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    }, [src]);

    // Build dimension styles and classes - use user-provided dimensions immediately
    const containerStyle: React.CSSProperties = {};
    const imageStyle: React.CSSProperties = {};
    const dimensionClasses: Array<string> = [];

    // Handle height
    if (height !== undefined) {
      if (typeof height === "number") {
        containerStyle.height = `${height}px`;
      } else if (typeof height === "string") {
        // If it's a Tailwind class (like "h-12"), add to classes
        if (height.match(/^h-/) || height.match(/^\[h-/)) {
          dimensionClasses.push(height);
        } else {
          // If it's a numeric string, add px; otherwise use as-is
          const numericHeight = Number(height);
          if (!isNaN(numericHeight)) {
            containerStyle.height = `${numericHeight}px`;
          } else {
            containerStyle.height = height;
          }
        }
      }
    }

    // Handle width
    if (width !== undefined) {
      if (typeof width === "number") {
        containerStyle.width = `${width}px`;
      } else if (typeof width === "string") {
        // If it's a Tailwind class (like "w-12"), add to classes
        if (width.match(/^w-/) || width.match(/^\[w-/)) {
          dimensionClasses.push(width);
        } else {
          // If it's a numeric string, add px; otherwise use as-is
          const numericWidth = Number(width);
          if (!isNaN(numericWidth)) {
            containerStyle.width = `${numericWidth}px`;
          } else {
            containerStyle.width = width;
          }
        }
      }
    }

    // Handle aspect ratio
    if (aspectRatio) {
      if (aspectRatio.match(/^aspect-/)) {
        dimensionClasses.push(aspectRatio);
      } else {
        containerStyle.aspectRatio = aspectRatio;
        imageStyle.aspectRatio = aspectRatio;
      }
    }

    // Ensure image fits container exactly - always fill the container
    imageStyle.width = "100%";
    imageStyle.height = "100%";
    imageStyle.objectFit = "cover";

    return (
      <div className={cn("relative mx-auto", dimensionClasses)} style={containerStyle}>
        {isLoading && !hasError && (
          <Skeleton
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              dimensionClasses,
              skeletonClassName,
            )}
          >
            {alt && <span className="text-xs text-muted-foreground px-2 text-center">{alt}</span>}
          </Skeleton>
        )}
        {src && !hasError && (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={cn(
              "transition-opacity duration-200",
              isLoading ? "opacity-0" : "opacity-100",
              className,
            )}
            style={imageStyle}
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        )}
      </div>
    );
  },
);

ImageSkeleton.displayName = "ImageSkeleton";

export { ImageSkeleton };
