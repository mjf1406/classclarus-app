import { ListFilter, UsersRound, XIcon } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { GroupImageIcon } from "@/components/groups/GroupImageIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import type { BoardGroup, BoardTeam } from "@/lib/groups/groups";
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
  /** Smaller icon buttons for tight headers. */
  compact?: boolean;
  /** Extra controls on the same wrapping row as the filter chips. */
  trailing?: ReactNode;
};

type FilterIconButtonProps = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  compact?: boolean;
  children: ReactNode;
};

type FilterRowsProps = {
  groups: BoardGroup[];
  visibleTeams: BoardTeam[];
  groupIds: string[];
  teamIds: string[];
  includeUngrouped: boolean;
  filtersActive: boolean;
  compact: boolean;
  ungroupedLabel: string;
  groupsLabel: string;
  teamsLabel: string;
  clearLabel: string;
  onToggleUngrouped: () => void;
  onToggleGroup: (groupId: Id<"groups">) => void;
  onToggleTeam: (teamId: Id<"teams">) => void;
  onClear: () => void;
};

function FilterIconButton({
  label,
  pressed,
  onClick,
  compact = false,
  children,
}: FilterIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size={compact ? "icon-sm" : "icon"}
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn("shrink-0 p-0.5", compact ? "size-8" : "size-10")}
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

function FilterRows({
  groups,
  visibleTeams,
  groupIds,
  teamIds,
  includeUngrouped,
  filtersActive,
  compact,
  ungroupedLabel,
  groupsLabel,
  teamsLabel,
  clearLabel,
  onToggleUngrouped,
  onToggleGroup,
  onToggleTeam,
  onClear,
}: FilterRowsProps) {
  const iconClassName = compact ? "size-3.5" : "size-4";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={groupsLabel}>
        <FilterIconButton
          label={ungroupedLabel}
          pressed={includeUngrouped}
          compact={compact}
          onClick={onToggleUngrouped}
        >
          <div
            className={cn(
              "flex size-full items-center justify-center rounded-[1.1rem]",
              includeUngrouped
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <UsersRound className={iconClassName} />
          </div>
        </FilterIconButton>

        {groups.map((group) => {
          const pressed = groupIds.includes(group._id);
          return (
            <FilterIconButton
              key={group._id}
              label={group.name}
              pressed={pressed}
              compact={compact}
              onClick={() => {
                onToggleGroup(group._id);
              }}
            >
              <GroupImageIcon
                imageFileId={group.imageFileId}
                icon={group.icon}
                alt=""
                className="size-full rounded-[1.1rem]"
                iconClassName={iconClassName}
              />
            </FilterIconButton>
          );
        })}

        {filtersActive ? (
          <Button type="button" size="icon-sm" variant="ghost" onClick={onClear}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{clearLabel}</span>
          </Button>
        ) : null}
      </div>

      {visibleTeams.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={teamsLabel}>
          {visibleTeams.map((team) => {
            const pressed = teamIds.includes(team._id);
            return (
              <FilterIconButton
                key={team._id}
                label={team.name}
                pressed={pressed}
                compact={compact}
                onClick={() => {
                  onToggleTeam(team._id);
                }}
              >
                <GroupImageIcon
                  imageFileId={team.imageFileId}
                  icon={team.icon}
                  alt=""
                  className="size-full rounded-[1.1rem]"
                  iconClassName={iconClassName}
                />
              </FilterIconButton>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function GroupTeamFilterButtons({
  classId,
  className,
  compact = false,
  trailing,
}: GroupTeamFilterButtonsProps) {
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
    const teams: BoardTeam[] = [];
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

  const rowClassName = cn("flex flex-wrap items-center gap-2", className);

  if (!board || board.groups.length === 0) {
    if (!trailing) return null;
    return <div className={rowClassName}>{trailing}</div>;
  }

  const filtersActive = hasGroupTeamMembershipFilters({
    groupIds,
    teamIds,
    includeUngrouped,
  });
  const activeCount = groupIds.length + (includeUngrouped ? 1 : 0) + teamIds.length;
  const ungroupedLabel = t("groupsUngroupedTitle");
  const filterButtonLabel = t("groupTeamFilterButton");
  const groupsLabel = t("groupTeamFilterGroupsLabel");
  const teamsLabel = t("groupTeamFilterTeamsLabel");
  const clearLabel = t("groupTeamFilterClear");

  const filterRowProps: FilterRowsProps = {
    groups: board.groups,
    visibleTeams,
    groupIds,
    teamIds,
    includeUngrouped,
    filtersActive,
    compact,
    ungroupedLabel,
    groupsLabel,
    teamsLabel,
    clearLabel,
    onToggleUngrouped: toggleUngrouped,
    onToggleGroup: toggleGroup,
    onToggleTeam: toggleTeam,
    onClear: clear,
  };

  return (
    <div className={rowClassName}>
      <div className="md:hidden">
        <Popover>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size={compact ? "icon-sm" : "icon"}
                    variant={filtersActive ? "default" : "outline"}
                    className="relative"
                    aria-label={filterButtonLabel}
                  />
                }
              >
                <ListFilter />
                {filtersActive ? (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]"
                  >
                    {activeCount}
                  </Badge>
                ) : null}
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{filterButtonLabel}</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-3">
            <PopoverHeader className="gap-1">
              <PopoverTitle className="text-sm">{filterButtonLabel}</PopoverTitle>
            </PopoverHeader>
            <div className="flex flex-col gap-2">
              <FilterRows {...filterRowProps} />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        className={cn(
          "hidden md:flex",
          trailing
            ? "flex-wrap items-center gap-2"
            : "flex-col gap-2 md:flex-row md:flex-wrap md:items-center",
        )}
      >
        <FilterRows {...filterRowProps} />
      </div>

      {trailing}
    </div>
  );
}
