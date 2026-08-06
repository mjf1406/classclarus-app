import { UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClassPresenceContext } from "@/components/presence/classPresenceContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PresenceState } from "@/hooks/presence/useClassPresence";
import { getDisplayName, getInitials } from "@/lib/user/userDisplay";

function presenceLabel(
  entry: PresenceState,
  unnamedFallback: string,
): { name: string; initials: string } {
  const fields = { _id: entry.userId, name: entry.name };
  return {
    name: getDisplayName(fields, unnamedFallback),
    initials: getInitials(fields),
  };
}

function statusLabel(
  entry: PresenceState,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (entry.online) {
    return t("presenceOnlineNow");
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - entry.lastDisconnected) / 1000));
  if (diffSec < 60) {
    return t("presenceLastSeenJustNow");
  }
  if (diffSec < 3600) {
    return t("presenceLastSeenMinutes", { count: Math.floor(diffSec / 60) });
  }
  if (diffSec < 86400) {
    return t("presenceLastSeenHours", { count: Math.floor(diffSec / 3600) });
  }
  return t("presenceLastSeenDays", { count: Math.floor(diffSec / 86400) });
}

function PresenceAvatar({
  entry,
  unnamedFallback,
}: {
  entry: PresenceState;
  unnamedFallback: string;
}) {
  const { name, initials } = presenceLabel(entry, unnamedFallback);
  return (
    <Avatar size="default" className={entry.online ? undefined : "opacity-60"}>
      {entry.image ? (
        <AvatarImage src={entry.image} alt={name} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function ClassPresenceChip() {
  const { t } = useTranslation("classes");
  const { presenceState } = useClassPresenceContext();
  const unnamed = t("unnamedMember");

  if (presenceState === undefined) {
    return null;
  }

  const online = presenceState.filter((entry) => entry.online);
  if (online.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-muted-foreground"
            aria-label={t("presenceAriaLabel", { count: online.length })}
          />
        }
      >
        <UsersIcon data-icon="inline-start" />
        <span className="tabular-nums md:hidden">{online.length}</span>
        <span className="hidden md:inline">{t("presenceChipLabel", { count: online.length })}</span>
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500 max-md:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("presenceListTitle")}</DropdownMenuLabel>
          {online.map((entry) => {
            const { name } = presenceLabel(entry, unnamed);
            return (
              <DropdownMenuItem key={entry.userId} className="gap-2">
                <PresenceAvatar entry={entry} unnamedFallback={unnamed} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {statusLabel(entry, t)}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
