import type { ReactNode } from "react";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { isEmojiIcon, isFontAwesomeIconId } from "@/lib/classes/classFormSchema";
import { cn } from "@/lib/utils";

type ClassIconDisplayProps = {
  icon?: string | null;
  className?: string;
  fallbackClassName?: string;
  /** Shown when `icon` is missing or not a recognized emoji / Font Awesome id. */
  fallback?: ReactNode;
  /** Size/color classes for the Font Awesome glyph (default `text-lg`). */
  iconClassName?: string;
};

export function ClassIconDisplay({
  icon,
  className,
  fallbackClassName,
  fallback,
  iconClassName,
}: ClassIconDisplayProps) {
  const trimmed = icon?.trim() ?? "";

  if (trimmed && isEmojiIcon(trimmed)) {
    return (
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-lg",
          className,
        )}
        aria-hidden="true"
      >
        {trimmed}
      </span>
    );
  }

  if (trimmed && isFontAwesomeIconId(trimmed)) {
    return (
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary",
          className,
        )}
      >
        <FontAwesomeIconFromId
          id={trimmed}
          className={cn("text-lg", iconClassName)}
          fallback={<span className="size-4 rounded bg-muted" />}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted",
        fallbackClassName ?? className,
      )}
      aria-hidden="true"
    >
      {fallback}
    </span>
  );
}
