import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { Skeleton } from "@/components/ui/skeleton";
import { useFileBytes } from "@/hooks/files/useFileBytes";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupImageIconProps = {
  imageFileId?: Id<"files">;
  icon?: string;
  className?: string;
  iconClassName?: string;
  alt: string;
};

/**
 * Prefers a class-library image over a Font Awesome icon string.
 */
export function GroupImageIcon({
  imageFileId,
  icon,
  className,
  iconClassName,
  alt,
}: GroupImageIconProps) {
  const { t } = useTranslation("classes");
  const { url, isPending, isError } = useFileBytes(imageFileId);

  if (imageFileId !== undefined) {
    if (isPending) {
      return <Skeleton className={cn("size-9 shrink-0 rounded-lg", className)} />;
    }
    if (!isError && url) {
      return (
        <img
          src={url}
          alt={alt}
          className={cn("size-9 shrink-0 rounded-lg object-cover", className)}
        />
      );
    }
    // Fall through to FA / default if the image fails to load.
  }

  const decorative = alt.trim().length === 0;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative && imageFileId !== undefined ? t("groupsImageLoadFailed") : undefined}
    >
      <FontAwesomeIconFromId
        id={icon}
        className={cn("size-4", iconClassName)}
        fallback={<UsersRound className={cn("size-4", iconClassName)} />}
      />
    </div>
  );
}
