import { UsersRound, XIcon } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { GroupImageIcon } from "@/components/groups/GroupImageIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import {
  allowedTeamIdsForFilters,
  groupTeamFilterStatesEqual,
  hasGroupTeamMembershipFilters,
  pruneOrphanedTeamIds,
} from "@/lib/groups/groupTeamFilters";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupTeamFilterButtonsProps = {
  classId: Id<"classes">;
  className?: string;
};

type FilterIconButtonProps = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

function FilterIconButton({ label, pressed, onClick, children }: FilterIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            onClick={onClick}
            className="size-10 shrink-0 p-0.5"
          />
        }
      >
        <span aria-hidden="true" className="flex size-full items-center justify-center">
          {children}
        </span>
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function GroupTeamFilterButtons({ classId, className }: GroupTeamFilterButtonsProps) {
  const { t } = useTranslation("classes");
  const { data: board } = useGroupsBoard(classId);
  const {
    groupIds,
    teamIds,
    includeUngrouped,
    toggleGroup,
    toggleTeam,
    toggleUngrouped,
    clear,
    setState,
  } = useGroupTeamFilterState(classId);

  const visibleTeams = useMemo(() => {
    if (!board) return [];
    const selectedGroups = new Set(groupIds);
    const teams: Array<{
      _id: Id<"teams">;
      name: string;
      icon?: string;
      imageFileId?: Id<"files">;
    }> = [];
    for (const group of board.groups) {
      if (selectedGroups.size > 0 && !selectedGroups.has(group._id)) {
        continue;
      }
      for (const team of group.teams) {
        teams.push(team);
      }
    }
    return teams;
  }, [board, groupIds]);

  useEffect(() => {
    if (!board) return;
    const current = { groupIds, teamIds, includeUngrouped };
    const pruned = pruneOrphanedTeamIds(current, allowedTeamIdsForFilters(board, groupIds));
    if (!groupTeamFilterStatesEqual(pruned, current)) {
      setState(pruned);
    }
  }, [board, groupIds, teamIds, includeUngrouped, setState]);

  if (!board || board.groups.length === 0) {
    return null;
  }

  const filtersActive = hasGroupTeamMembershipFilters({
    groupIds,
    teamIds,
    includeUngrouped,
  });

  const ungroupedLabel = t("groupsUngroupedTitle");

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("groupTeamFilterGroupsLabel")}
      >
        <FilterIconButton
          label={ungroupedLabel}
          pressed={includeUngrouped}
          onClick={() => {
            toggleUngrouped();
          }}
        >
          <div
            className={cn(
              "flex size-full items-center justify-center rounded-[1.1rem]",
              includeUngrouped
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <UsersRound className="size-4" />
          </div>
        </FilterIconButton>

        {board.groups.map((group) => {
          const pressed = groupIds.includes(group._id);
          return (
            <FilterIconButton
              key={group._id}
              label={group.name}
              pressed={pressed}
              onClick={() => {
                toggleGroup(group._id);
              }}
            >
              <GroupImageIcon
                imageFileId={group.imageFileId}
                icon={group.icon}
                alt=""
                className="size-full rounded-[1.1rem]"
                iconClassName="size-4"
              />
            </FilterIconButton>
          );
        })}

        {filtersActive ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              clear();
            }}
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("groupTeamFilterClear")}</span>
          </Button>
        ) : null}
      </div>

      {visibleTeams.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("groupTeamFilterTeamsLabel")}
        >
          {visibleTeams.map((team) => {
            const pressed = teamIds.includes(team._id);
            return (
              <FilterIconButton
                key={team._id}
                label={team.name}
                pressed={pressed}
                onClick={() => {
                  toggleTeam(team._id);
                }}
              >
                <GroupImageIcon
                  imageFileId={team.imageFileId}
                  icon={team.icon}
                  alt=""
                  className="size-full rounded-[1.1rem]"
                  iconClassName="size-4"
                />
              </FilterIconButton>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
