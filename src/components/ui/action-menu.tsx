import { MoreVerticalIcon } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useOptionalClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import type { ClassPermission } from "@/lib/permissions/classPermissions";

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** When set, the item is hidden unless the viewer has this permission. */
  permission?: ClassPermission;
  variant?: "default" | "destructive";
  /** Consecutive items with the same group share a DropdownMenuGroup; changes insert separators. */
  group?: string;
  /** Return a Promise to keep the menu open with a loading state until it settles. */
  onSelect: () => void | Promise<void>;
};

type ActionMenuProps = {
  items: Array<ActionMenuItem>;
  label: string;
  align?: "start" | "center" | "end";
  className?: string;
};

/**
 * Permission-aware action menu. Items the viewer cannot perform are hidden silently.
 * Renders nothing when no items remain after filtering.
 */
export function ActionMenu({ items, label, align = "end", className }: ActionMenuProps) {
  const permissions = useOptionalClassPermissionsContext();
  const isPending = permissions?.isPending ?? false;
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (isPending) return [];
    const can = permissions?.can ?? (() => true);
    return items.filter((item) => !item.permission || can(item.permission));
  }, [items, permissions, isPending]);

  if (visibleItems.length === 0) {
    return null;
  }

  const groups: Array<Array<ActionMenuItem>> = [];
  for (const item of visibleItems) {
    const groupKey = item.group ?? item.id;
    const last = groups[groups.length - 1];
    const lastKey = last?.[0]?.group ?? last?.[0]?.id;
    if (last && lastKey === groupKey) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }

  const runSelect = (item: ActionMenuItem) => {
    if (pendingId !== null) return;
    const result = item.onSelect();
    if (!(result instanceof Promise)) {
      setOpen(false);
      return;
    }
    setPendingId(item.id);
    void result.finally(() => {
      setPendingId(null);
      setOpen(false);
    });
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (!next && pendingId !== null) {
          eventDetails.cancel();
          return;
        }
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={className ?? "relative z-10"}
            aria-label={label}
          />
        }
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {groups.map((group, groupIndex) => (
          <Fragment key={group[0]?.id ?? groupIndex}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              {group.map((item) => {
                const itemPending = pendingId === item.id;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    variant={item.variant}
                    closeOnClick={false}
                    disabled={pendingId !== null && !itemPending}
                    aria-busy={itemPending || undefined}
                    onClick={() => {
                      runSelect(item);
                    }}
                  >
                    {itemPending ? <Spinner /> : item.icon}
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
