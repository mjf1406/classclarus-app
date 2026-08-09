import { CheckIcon, ChevronDownIcon, CircleCheckBigIcon, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import PendingComponent from "@/components/loading/PendingComponent";
import { PointStudentCard } from "@/components/points/PointStudentCard";
import { PersonalPointsPage } from "@/components/points/PersonalPointsPage";
import { PointsApplyCredenza } from "@/components/points/PointsApplyCredenza";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useBehaviorFolders } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { useBehaviors } from "@/hooks/behaviors/useBehaviors";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useCan } from "@/hooks/permissions/useCan";
import { useApplyBehaviors } from "@/hooks/points/useApplyBehaviors";
import { usePointsMarkAbsent, usePointsMarkPresent } from "@/hooks/points/usePointsAttendance";
import { useEnsurePointsCounters, usePointsBoard } from "@/hooks/points/usePointsBoard";
import {
  useClearWarnings,
  useGiveWarning,
  useUndoLastWarning,
} from "@/hooks/points/usePointsWarnings";
import { useRedeemRewards } from "@/hooks/points/useRedeemRewards";
import { useRewardPurchaseLimits } from "@/hooks/points/useRewardPurchaseLimits";
import { useUndoLastPointsAction } from "@/hooks/points/useUndoLastPointsAction";
import { useRewardFolders } from "@/hooks/rewardFolders/useRewardFolders";
import { useRewards } from "@/hooks/rewards/useRewards";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import {
  isAbsentStudent,
  nextPointsSortState,
  sortPointsStudents,
  type PointsBoardStudent,
  type PointsSortDirection,
  type PointsSortKey,
} from "@/lib/points/points";
import { ONE_HOUR } from "@/lib/queryCache";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";

/** 3 cols always; 9.5rem cap keeps cards near phone size on wide viewports. */
const GRID_CLASS =
  "grid w-fit max-w-full gap-2 [grid-template-columns:repeat(3,minmax(0,9.5rem))] sm:gap-3";

const SORT_KEYS = ["firstName", "lastName", "rosterNumber", "points"] as const;

type PointsPageProps = {
  classId: Id<"classes">;
};

type PointsSortMenuProps = {
  sortKey: PointsSortKey;
  sortDirection: PointsSortDirection;
  labels: Record<PointsSortKey, string>;
  labelsShort: Record<PointsSortKey, string>;
  ariaLabel: string;
  onSortChange: (key: PointsSortKey) => void;
};

function PointsSortMenu({
  sortKey,
  sortDirection,
  labels,
  labelsShort,
  ariaLabel,
  onSortChange,
}: PointsSortMenuProps) {
  const directionMark = sortDirection === "asc" ? "↑" : "↓";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="shrink-0" aria-label={ariaLabel} />
        }
      >
        {/* Stack all short labels invisibly so the trigger width never shifts. */}
        <span className="inline-grid justify-items-start">
          {SORT_KEYS.map((key) => (
            <span
              key={key}
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
              aria-hidden="true"
            >
              {labelsShort[key]} <span className="inline-block w-[1em] text-center">↑</span>
            </span>
          ))}
          <span className="col-start-1 row-start-1 whitespace-nowrap">
            {labelsShort[sortKey]}{" "}
            <span className="inline-block w-[1em] text-center">{directionMark}</span>
          </span>
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        <DropdownMenuGroup>
          {SORT_KEYS.map((key) => {
            const active = key === sortKey;
            return (
              <DropdownMenuItem key={key} onClick={() => onSortChange(key)}>
                <span className="min-w-0 flex-1">
                  {labels[key]}
                  {active ? ` ${directionMark}` : null}
                </span>
                {active ? <CheckIcon /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PointsPage({ classId }: PointsPageProps) {
  const { can, isPending: permissionsPending } = useCan();

  if (permissionsPending) {
    return <PendingComponent />;
  }
  if (!can("points:manage")) {
    return <PersonalPointsPage classId={classId} />;
  }

  return <StaffPointsPage classId={classId} />;
}

function StaffPointsPage({ classId }: PointsPageProps) {
  const { t } = useTranslation("points");
  const { can, isPending: permissionsPending } = useCan();
  const canManageAttendance = !permissionsPending && can("attendance:manage");
  const dateKey = useMemo(() => localDateKey(), []);

  const { data, isPending, isError, refetch, isAuthLoading } = usePointsBoard(classId, dateKey);
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data: groupsBoard } = useGroupsBoard(classId);
  const { data: behaviors } = useBehaviors(classId);
  const { data: rewards } = useRewards(classId);
  const { data: behaviorFolders } = useBehaviorFolders(classId);
  const { data: rewardFolders } = useRewardFolders(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);

  useEnsureStudentRosters(classId, !isPending && !isAuthLoading && !isError);
  useEnsurePointsCounters(classId, !isPending && !isAuthLoading && !isError);

  const applyBehaviors = useApplyBehaviors();
  const redeemRewards = useRedeemRewards();
  const undoPoints = useUndoLastPointsAction();
  const giveWarning = useGiveWarning();
  const undoWarning = useUndoLastWarning();
  const clearWarnings = useClearWarnings();
  const markAbsent = usePointsMarkAbsent();
  const markPresent = usePointsMarkPresent();

  const [sortKey, setSortKey] = useState<PointsSortKey>("firstName");
  const [sortDirection, setSortDirection] = useState<PointsSortDirection>("asc");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"users">>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTargets, setApplyTargets] = useState<PointsBoardStudent[]>([]);
  const applyTargetIds = useMemo(
    () => applyTargets.map((student) => student.userId),
    [applyTargets],
  );
  const purchaseLimits = useRewardPurchaseLimits(classId, applyTargetIds, applyOpen);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const membershipByUserId = useMemo(
    () => (groupsBoard ? buildMembershipIndex(groupsBoard) : {}),
    [groupsBoard],
  );

  const filterState = useMemo(
    () => ({
      groupIds: groupTeamFilterState.groupIds,
      teamIds: groupTeamFilterState.teamIds,
      includeUngrouped: groupTeamFilterState.includeUngrouped,
    }),
    [
      groupTeamFilterState.groupIds,
      groupTeamFilterState.teamIds,
      groupTeamFilterState.includeUngrouped,
    ],
  );

  const { filtered } = useStudentRosterFilter({
    members: data,
    query: "",
    membershipByUserId,
    filterState,
  });

  const sorted = useMemo(
    () => sortPointsStudents(filtered, sortKey, sortDirection),
    [filtered, sortDirection, sortKey],
  );

  const sortLabels: Record<PointsSortKey, string> = {
    firstName: t("sortFirstName"),
    lastName: t("sortLastName"),
    rosterNumber: t("sortRosterNumber"),
    points: t("sortPoints"),
  };
  const sortLabelsShort: Record<PointsSortKey, string> = {
    firstName: t("sortFirstNameShort"),
    lastName: t("sortLastNameShort"),
    rosterNumber: t("sortRosterNumberShort"),
    points: t("sortPointsShort"),
  };

  const openForStudents = (students: PointsBoardStudent[]) => {
    if (students.length === 0) return;
    setApplyTargets(students);
    setApplyOpen(true);
  };

  const toggleSelect = (student: PointsBoardStudent) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(student.userId)) next.delete(student.userId);
      else next.add(student.userId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const student of sorted) {
        if (isAbsentStudent(student) && !next.has(student.userId)) {
          continue;
        }
        next.add(student.userId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedStudents = useMemo(
    () => sorted.filter((student) => selectedIds.has(student.userId)),
    [selectedIds, sorted],
  );

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="hidden text-muted-foreground sm:block">{t("description")}</p>
      </div>

      <GroupTeamFilterButtons classId={classId} />

      <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
        <PointsSortMenu
          sortKey={sortKey}
          sortDirection={sortDirection}
          labels={sortLabels}
          labelsShort={sortLabelsShort}
          ariaLabel={t("sortMenuAria", {
            label: sortLabels[sortKey],
            direction: sortDirection === "asc" ? t("sortDirectionAsc") : t("sortDirectionDesc"),
          })}
          onSortChange={(key) => {
            const state = nextPointsSortState(sortKey, sortDirection, key);
            setSortKey(state.sortKey);
            setSortDirection(state.sortDirection);
          }}
        />
        {selectMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-dashed"
              onClick={() => {
                setSelectMode(false);
                clearSelection();
              }}
            >
              <span aria-hidden="true">{t("selectModeOn")}</span>
              <span className="sr-only">{t("selectModeOnAria")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-dashed"
              aria-label={t("selectAllVisibleAria")}
              onClick={selectAllVisible}
            >
              {t("selectAllVisible")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-dashed border-primary text-primary hover:bg-primary/10 hover:text-primary"
              disabled={selectedStudents.length === 0}
              onClick={() => openForStudents(selectedStudents)}
            >
              <CircleCheckBigIcon aria-hidden="true" />
              <span className="sr-only">
                {t("applyToSelectedAria", { count: selectedStudents.length })}
              </span>
            </Button>
          </>
        ) : null}
      </div>

      {isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && sorted.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && sorted.length > 0 ? (
        <div className={GRID_CLASS}>
          {sorted.map((student) => (
            <PointStudentCard
              key={student.userId}
              student={student}
              nameFormat={nameFormat}
              selectMode={selectMode}
              selected={selectedIds.has(student.userId)}
              canManageAttendance={canManageAttendance}
              onOpen={() => openForStudents([student])}
              onToggleSelect={() => toggleSelect(student)}
              onLongPressSelect={() => {
                setSelectMode(true);
                setSelectedIds((prev) => {
                  if (prev.has(student.userId)) return prev;
                  const next = new Set(prev);
                  next.add(student.userId);
                  return next;
                });
              }}
              onGiveWarning={() => {
                void giveWarning.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  dateKey,
                });
              }}
              onUndoWarning={() => {
                void undoWarning.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  dateKey,
                });
              }}
              onClearWarnings={() => {
                void clearWarnings.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  dateKey,
                });
              }}
              onMarkAbsent={() => {
                void markAbsent.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  dateKey,
                });
              }}
              onMarkPresent={() => {
                void markPresent.mutateAsync({
                  classId,
                  studentUserId: student.userId,
                  dateKey,
                });
              }}
              onUndoPoints={() =>
                undoPoints
                  .mutateAsync({
                    classId,
                    studentUserId: student.userId,
                    dateKey,
                  })
                  .then((result) => {
                    if (result.kind === "none") {
                      toast.add({ title: t("undoPointsNone"), type: "info" });
                    }
                  })
              }
            />
          ))}
        </div>
      ) : null}

      <PointsApplyCredenza
        open={applyOpen}
        onOpenChange={setApplyOpen}
        students={applyTargets}
        nameFormat={nameFormat}
        behaviors={behaviors ?? []}
        rewards={rewards ?? []}
        behaviorFolders={behaviorFolders ?? []}
        rewardFolders={rewardFolders ?? []}
        purchaseLimitStatuses={purchaseLimits.data ?? []}
        purchaseLimitsPending={purchaseLimits.isPending}
        onApplyBehaviors={async ({ mode, items, note }) => {
          await applyBehaviors.mutateAsync({
            classId,
            dateKey,
            studentUserIds: applyTargets.map((student) => student.userId),
            mode,
            items,
            ...(note ? { note } : {}),
          });
          clearSelection();
          setSelectMode(false);
        }}
        onRedeemRewards={async ({ items, allowOverride }) => {
          await redeemRewards.mutateAsync({
            classId,
            dateKey,
            studentUserIds: applyTargets.map((student) => student.userId),
            items,
            timeZoneOffsetMinutes: purchaseLimits.timeZoneOffsetMinutes,
            allowOverride,
          });
          clearSelection();
          setSelectMode(false);
        }}
      />
    </div>
  );
}
