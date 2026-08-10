import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/user/userDisplay";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";
import type { Id } from "../../../convex/_generated/dataModel";

type RosterStudentChipProps = useRender.ComponentProps<"div"> & {
  userId: Id<"users">;
  displayName: string;
  rosterNumber?: number | null;
  image?: string | null;
  email?: string | null;
  /** Drag handle affordance for draggable contexts. */
  showGrip?: boolean;
  /** Highlight when this chip is the signed-in viewer. */
  isSelf?: boolean;
  trailing?: ReactNode;
};

/**
 * Compact student chip used for drag/drop surfaces (groups board, seat chart roster).
 * Roster number sits on the left, matching roster cards elsewhere in the app.
 */
export function RosterStudentChip({
  userId,
  displayName,
  rosterNumber,
  image,
  email,
  showGrip = false,
  isSelf = false,
  trailing,
  className,
  render,
  ...props
}: RosterStudentChipProps) {
  const safeImage = sanitizeAvatarUrl(image ?? undefined);
  const rosterLabel = rosterNumber != null ? String(rosterNumber) : "–";

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex w-full items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-left text-sm shadow-sm",
          isSelf && "border-primary bg-primary/10 ring-2 ring-primary/40",
          className,
        ),
        children: (
          <>
            {showGrip ? (
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {rosterLabel}
            </span>
            <Avatar className="size-6 shrink-0">
              {safeImage ? (
                <AvatarImage src={safeImage} alt={displayName} referrerPolicy="no-referrer" />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {getInitials({
                  _id: userId,
                  name: displayName,
                  email: email ?? undefined,
                })}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span>
            {trailing}
          </>
        ),
      },
      props,
    ),
    render,
  });
}
