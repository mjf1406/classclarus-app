import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { GroupImageIcon } from "@/components/groups/GroupImageIcon";
import { SeatChartRecordConfirmCredenza } from "@/components/assigners/SeatChartRecordConfirmCredenza";
import { SeatChartRecordViewerCredenza } from "@/components/assigners/SeatChartRecordViewerCredenza";
import { SeatChartStudentInspector } from "@/components/assigners/SeatChartStudentInspector";
import { SeatLayoutUnsavedChangesDialog } from "@/components/assigners/SeatLayoutUnsavedChangesDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { HelpTip } from "@/components/ui/help-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast-manager";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useRecordSeatChart } from "@/hooks/assigners/useRecordSeatChart";
import { useSaveSeatChartDraft } from "@/hooks/assigners/useSaveSeatChartDraft";
import { useSeatChart } from "@/hooks/assigners/useSeatChart";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useCan } from "@/hooks/permissions/useCan";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import {
  compressSeatItemGaps,
  resolveTeamLabel,
  seatItemDisplayLabel,
  SEAT_CANVAS_GRID_SIZE,
  SEAT_ORIENTATION_DEGREES,
  type SeatLayoutItem,
  type SeatOrientation,
} from "@/lib/assigners/seatLayouts";
import { computeSeatsPrintCrop } from "@/lib/assigners/seatsPrint";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import {
  assignStudentToSlot,
  assignmentsEqual,
  hydrateAssignmentsFromBoard,
  neighborDeskIdsForDesk,
  studentAssignmentMap,
  type SeatChartAssignment,
  type SeatChartCohortFilter,
  type SeatChartViolation,
  unassignDeskSlot,
  violationsForStudent,
} from "@/lib/assigners/seatCharts";
import { buildMembershipIndex, hasGroupTeamMembershipFilters } from "@/lib/groups/groupTeamFilters";
import type { GroupsBoard } from "@/lib/groups/groups";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { cn } from "@/lib/utils";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** Inset inside the chart viewport when fitting the cropped layout. */
const CHART_CANVAS_FIT_PADDING_PX = 12;

type SelectedSlot = { deskId: string; groupId: Id<"groups"> };

type AssignmentSnapshot = { assignments: Array<SeatChartAssignment> };

function cloneAssignmentSnapshot(snapshot: AssignmentSnapshot): AssignmentSnapshot {
  return { assignments: snapshot.assignments.map((a) => ({ ...a })) };
}

type SeatChartEditorPageProps = {
  classId: Id<"classes">;
  chartId: Id<"seatCharts">;
};

function studentInCohort(
  board: GroupsBoard | undefined,
  cohort: SeatChartCohortFilter,
  filterState: ReturnType<typeof useGroupTeamFilterState>,
  userId: Id<"users">,
): boolean {
  if (cohort === "class") return true;
  if (!board) return true;
  const membership = buildMembershipIndex(board)[userId];
  if (cohort === "group") {
    if (!hasGroupTeamMembershipFilters(filterState)) return true;
    if (filterState.includeUngrouped && !membership?.groupId) return true;
    if (membership?.groupId && filterState.groupIds.includes(membership.groupId)) return true;
    return false;
  }
  if (!hasGroupTeamMembershipFilters(filterState)) return true;
  if (membership?.teamId && filterState.teamIds.includes(membership.teamId)) return true;
  return false;
}

export function SeatChartEditorPage({ classId, chartId }: SeatChartEditorPageProps) {
  const { t } = useTranslation("assigners");
  const convex = useConvex();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: chart, isPending, isError, refetch } = useSeatChart(classId, chartId);
  const { data: classDoc } = useClass(classId);
  const { data: roster } = useStudentRoster(classId);
  const { data: board } = useGroupsBoard(classId);
  const filterState = useGroupTeamFilterState(classId);
  const saveDraft = useSaveSeatChartDraft();
  const recordSeating = useRecordSeatChart();

  const [assignments, setAssignments] = useState<Array<SeatChartAssignment>>([]);
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"users"> | null>(null);
  const [cohort, setCohort] = useState<SeatChartCohortFilter>("class");
  const [orientation] = useState<SeatOrientation>("front");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordViewerId, setRecordViewerId] = useState<Id<"seatChartRecords"> | null>(null);
  const [violations, setViolations] = useState<Array<SeatChartViolation>>([]);
  const [liveViolations, setLiveViolations] = useState<Array<SeatChartViolation>>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [dragStudentId, setDragStudentId] = useState<Id<"users"> | null>(null);

  const baselineRef = useRef<AssignmentSnapshot | null>(null);
  const pastRef = useRef<Array<AssignmentSnapshot>>([]);
  const futureRef = useRef<Array<AssignmentSnapshot>>([]);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = t("constraintUnknownStudent");

  useLayoutEffect(() => {
    const el = canvasViewportRef.current;
    if (!el) return;
    const update = () => {
      setCanvasViewportSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chart]);

  useEffect(() => {
    if (!chart || hydrated || !board) return;
    const membershipIndex = buildMembershipIndex(board);
    const groupIdByStudent: Record<string, Id<"groups">> = {};
    for (const [userId, membership] of Object.entries(membershipIndex)) {
      if (membership?.groupId) {
        groupIdByStudent[userId] = membership.groupId;
      }
    }
    const hydratedAssignments = hydrateAssignmentsFromBoard(chart.assignments, groupIdByStudent);
    const snapshot = { assignments: hydratedAssignments };
    setAssignments(hydratedAssignments);
    baselineRef.current = cloneAssignmentSnapshot(snapshot);
    pastRef.current = [];
    futureRef.current = [];
    setHydrated(true);
    setDirty(false);
  }, [chart, board, hydrated]);

  useEffect(() => {
    if (!hydrated || !chart) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await convex.query(api.seatCharts.previewViolations, {
          classId,
          chartId,
          assignments,
        });
        if (!cancelled) setLiveViolations(result);
      } catch {
        if (!cancelled) setLiveViolations([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assignments, chart, chartId, classId, convex, hydrated]);

  useEffect(() => {
    if (!baselineRef.current) return;
    setDirty(!assignmentsEqual(assignments, baselineRef.current.assignments));
  }, [assignments]);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const applyAssignments = useCallback(
    (next: Array<SeatChartAssignment>, pushHistory = true) => {
      if (pushHistory) {
        pastRef.current = [...pastRef.current, cloneAssignmentSnapshot({ assignments })].slice(-50);
        futureRef.current = [];
      }
      setAssignments(next);
      syncHistoryFlags();
    },
    [assignments, syncHistoryFlags],
  );

  const byStudent = useMemo(() => studentAssignmentMap(assignments), [assignments]);
  const membershipIndex = useMemo(() => (board ? buildMembershipIndex(board) : {}), [board]);

  const assignToSlot = useCallback(
    (deskId: string, groupId: Id<"groups">, studentUserId: Id<"users">) => {
      applyAssignments(assignStudentToSlot(assignments, deskId, groupId, studentUserId));
      setSelectedStudentId(studentUserId);
      setSelectedDeskId(deskId);
      setSelectedSlot({ deskId, groupId });
    },
    [applyAssignments, assignments],
  );

  const tryAssignStudent = useCallback(
    (deskId: string, studentUserId: Id<"users">, groupId?: Id<"groups">) => {
      const resolvedGroupId = groupId ?? membershipIndex[studentUserId]?.groupId;
      if (!resolvedGroupId) {
        toast.add({ type: "error", title: t("chartSlotUngrouped") });
        return;
      }
      assignToSlot(deskId, resolvedGroupId, studentUserId);
    },
    [assignToSlot, membershipIndex, t],
  );

  const { filtered: filteredRoster } = useStudentRosterFilter({
    members: roster,
    query: "",
    membershipByUserId: board ? buildMembershipIndex(board) : {},
    filterState:
      cohort === "class" ? { groupIds: [], teamIds: [], includeUngrouped: false } : filterState,
  });

  const visibleStudents = useMemo(() => {
    const base = filteredRoster ?? roster ?? [];
    return base.filter((student) => studentInCohort(board, cohort, filterState, student.userId));
  }, [board, cohort, filterState, filteredRoster, roster]);

  const highlightedNeighborDesks = useMemo(() => {
    if (!selectedDeskId && !selectedStudentId) return new Set<string>();
    const deskId =
      selectedDeskId ??
      (selectedStudentId ? byStudent.get(selectedStudentId)?.deskItemId : undefined);
    if (!deskId || !chart) return new Set<string>();
    return new Set(neighborDeskIdsForDesk(chart.layout.items, deskId));
  }, [byStudent, chart, selectedDeskId, selectedStudentId]);

  const seatedCount = assignments.length;
  const unseatedCount = Math.max(0, (roster?.length ?? 0) - seatedCount);

  const displayItems = useMemo(() => {
    if (!chart) return [] as Array<SeatLayoutItem>;
    return compressSeatItemGaps(chart.layout.items, {
      maxGapX: SEAT_CANVAS_GRID_SIZE,
      maxGapY: SEAT_CANVAS_GRID_SIZE,
    });
  }, [chart]);

  const canvasCrop = useMemo(() => {
    if (!chart || displayItems.length === 0) {
      return { offsetX: 0, offsetY: 0, width: 1, height: 1 };
    }
    let maxX = 1;
    let maxY = 1;
    for (const item of displayItems) {
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    }
    return computeSeatsPrintCrop(
      displayItems,
      maxX + SEAT_CANVAS_GRID_SIZE,
      maxY + SEAT_CANVAS_GRID_SIZE,
      SEAT_CANVAS_GRID_SIZE,
    );
  }, [chart, displayItems]);

  const canvasFitScale = useMemo(() => {
    const availW = Math.max(1, canvasViewportSize.width - CHART_CANVAS_FIT_PADDING_PX * 2);
    // Prefer filling width so desks stay readable; scroll vertically when needed.
    const raw = (availW / canvasCrop.width) * 0.8;
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [canvasCrop.width, canvasViewportSize.width]);

  const handleSave = async () => {
    if (!canManage || chart?.archivedAt) return;
    await saveDraft.mutateAsync({ classId, chartId, assignments });
    baselineRef.current = cloneAssignmentSnapshot({ assignments });
    setDirty(false);
  };

  const openRecordDialog = async () => {
    const result = await convex.query(api.seatCharts.previewViolations, {
      classId,
      chartId,
      assignments,
    });
    setViolations(result);
    setRecordOpen(true);
  };

  const handleRecord = async () => {
    if (!canManage || chart?.archivedAt) return;
    await recordSeating.mutateAsync({ classId, chartId, assignments });
    baselineRef.current = cloneAssignmentSnapshot({ assignments });
    setDirty(false);
  };

  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    withResolver: true,
    enableBeforeUnload: dirty,
  });

  const itemDefaults = {
    teacherDesk: t("defaultTeacherDeskLabel"),
    board: t("defaultBoardLabel"),
    rect: t("defaultRectLabel"),
  };

  if (isPending || !chart) {
    return <Skeleton className="mx-4 my-8 h-[70vh] w-auto rounded-2xl" />;
  }

  if (isError) {
    return (
      <ErrorState
        title={t("chartLoadFailed")}
        description={t("chartLoadFailedDescription")}
        onRetry={() => void refetch()}
      />
    );
  }

  const archived = chart.archivedAt !== undefined;

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{chart.name}</h1>
          <p className="text-sm text-muted-foreground">
            {chart.layout.name} · {t("chartNeighborsHelp")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? <Badge variant="outline">{t("editorSaveStatusUnsaved")}</Badge> : null}
          {archived ? <Badge variant="secondary">{t("chartArchivedBadge")}</Badge> : null}
          <Button
            type="button"
            variant="outline"
            disabled={!canUndo}
            onClick={() => {
              const previous = pastRef.current.at(-1);
              if (!previous) return;
              pastRef.current = pastRef.current.slice(0, -1);
              futureRef.current = [cloneAssignmentSnapshot({ assignments }), ...futureRef.current];
              setAssignments(previous.assignments.map((a) => ({ ...a })));
              syncHistoryFlags();
            }}
          >
            {t("chartUndo")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canRedo}
            onClick={() => {
              const next = futureRef.current[0];
              if (!next) return;
              futureRef.current = futureRef.current.slice(1);
              pastRef.current = [...pastRef.current, cloneAssignmentSnapshot({ assignments })];
              setAssignments(next.assignments.map((a) => ({ ...a })));
              syncHistoryFlags();
            }}
          >
            {t("chartRedo")}
          </Button>
          {canManage && !archived ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!dirty || saveDraft.isPending}
                onClick={() => void handleSave()}
              >
                {saveDraft.isPending ? t("editorSaveStatusSaving") : t("chartSaveDraft")}
              </Button>
              <Button
                type="button"
                disabled={recordSeating.isPending}
                onClick={() => void openRecordDialog()}
              >
                {t("chartRecordAction")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col p-4">
          <div
            ref={canvasViewportRef}
            className="min-h-0 flex-1 overflow-auto rounded-xl border bg-muted/20"
          >
            <div className="flex min-h-full items-center justify-center p-3">
              <div
                className="relative shrink-0"
                style={{
                  width: canvasCrop.width * canvasFitScale,
                  height: canvasCrop.height * canvasFitScale,
                }}
              >
                <div
                  className="absolute top-0 left-0 origin-top-left"
                  style={{
                    width: canvasCrop.width,
                    height: canvasCrop.height,
                    transform: `scale(${canvasFitScale})`,
                  }}
                >
                  <div
                    className="relative bg-background"
                    style={{
                      width: canvasCrop.width,
                      height: canvasCrop.height,
                      transform: `rotate(${SEAT_ORIENTATION_DEGREES[orientation]}deg)`,
                      transformOrigin: "center center",
                    }}
                  >
                    {displayItems.map((item: SeatLayoutItem) => {
                      const isDesk = item.kind === "desk";
                      const isSelected = selectedDeskId === item.id;
                      const isNeighbor = highlightedNeighborDesks.has(item.id);
                      const team = item.teamAssignment
                        ? resolveTeamLabel(item.teamAssignment, board?.groups ?? [])
                        : null;
                      const zoneLabel = item.zoneName?.trim() || null;
                      const deskMeta = [team?.label, zoneLabel].filter(Boolean).join(" · ");
                      const deskGroups = board?.groups ?? [];

                      return (
                        <div
                          key={item.id}
                          role={isDesk ? "group" : undefined}
                          aria-label={
                            isDesk && item.deskNumber !== undefined
                              ? t("chartDeskAria", {
                                  number: item.deskNumber,
                                  name:
                                    deskGroups.length > 0
                                      ? t("chartMultiSlotDesk")
                                      : t("chartEmptyDesk"),
                                })
                              : undefined
                          }
                          className={cn(
                            "absolute rounded-md border bg-card text-[5px] shadow-sm outline-none",
                            isDesk &&
                              "border-primary/40 focus-within:ring-2 focus-within:ring-ring",
                            isSelected && "ring-2 ring-primary",
                            isNeighbor && "border-amber-500/70 bg-amber-500/10",
                            dragStudentId && isDesk && "ring-1 ring-dashed ring-primary/60",
                          )}
                          style={{
                            left: item.x - canvasCrop.offsetX,
                            top: item.y - canvasCrop.offsetY,
                            width: item.width,
                            height: item.height,
                          }}
                          onDragOver={(event) => {
                            if (!isDesk || archived || !canManage) return;
                            event.preventDefault();
                          }}
                          onDrop={(event) => {
                            if (!isDesk || archived || !canManage) return;
                            event.preventDefault();
                            const raw = event.dataTransfer.getData(
                              "application/x-seat-chart-student",
                            );
                            if (!raw) return;
                            const slotGroupId =
                              selectedSlot?.deskId === item.id ? selectedSlot.groupId : undefined;
                            tryAssignStudent(item.id, raw as Id<"users">, slotGroupId);
                            setDragStudentId(null);
                          }}
                        >
                          {isDesk ? (
                            <div className="flex h-full min-h-0 flex-col gap-1 p-1.5">
                              <div className="flex min-w-0 items-baseline gap-1 px-0.5">
                                {item.deskNumber !== undefined ? (
                                  <span className="shrink-0 text-[5px] font-semibold tabular-nums leading-none">
                                    {item.deskNumber}
                                  </span>
                                ) : null}
                                {deskMeta ? (
                                  <span className="min-w-0 truncate text-[5px] text-muted-foreground leading-none">
                                    {deskMeta}
                                  </span>
                                ) : null}
                              </div>
                              {deskGroups.length === 0 ? (
                                <span className="flex flex-1 items-center justify-center text-muted-foreground">
                                  {t("chartEmptyDesk")}
                                </span>
                              ) : (
                                <div className="flex min-h-0 flex-1 gap-1">
                                  <div
                                    className="flex w-3.5 shrink-0 flex-col gap-0.5"
                                    aria-hidden="true"
                                  >
                                    {deskGroups.map((group) => (
                                      <div
                                        key={group._id}
                                        className="flex min-h-0 flex-1 items-center justify-center"
                                      >
                                        <GroupImageIcon
                                          imageFileId={group.imageFileId}
                                          icon={group.icon}
                                          alt=""
                                          className="size-2.5 rounded-sm"
                                          iconClassName="size-1.5"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
                                    {deskGroups.map((group) => {
                                      const slotAssignment = assignments.find(
                                        (assignment) =>
                                          assignment.deskItemId === item.id &&
                                          assignment.groupId === group._id,
                                      );
                                      const student = roster?.find(
                                        (entry) => entry.userId === slotAssignment?.studentUserId,
                                      );
                                      const displayName = student
                                        ? getRosterDisplayName(student, unnamed, nameFormat)
                                        : t("chartSlotEmpty");
                                      const slotSelected =
                                        selectedSlot?.deskId === item.id &&
                                        selectedSlot.groupId === group._id;
                                      return (
                                        <button
                                          key={group._id}
                                          type="button"
                                          className={cn(
                                            "flex min-h-0 flex-1 items-center rounded border border-border/60 px-1 py-0.5 text-left",
                                            slotSelected && "ring-1 ring-primary",
                                            canManage && !archived && "hover:bg-accent/30",
                                          )}
                                          aria-label={t("chartDeskSlotAria", {
                                            group: group.name,
                                            name: displayName,
                                          })}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedDeskId(item.id);
                                            setSelectedSlot({
                                              deskId: item.id,
                                              groupId: group._id,
                                            });
                                            if (slotAssignment) {
                                              setSelectedStudentId(slotAssignment.studentUserId);
                                            }
                                            if (dragStudentId && canManage && !archived) {
                                              tryAssignStudent(item.id, dragStudentId, group._id);
                                              setDragStudentId(null);
                                              return;
                                            }
                                            if (
                                              selectedStudentId &&
                                              canManage &&
                                              !archived &&
                                              !slotAssignment
                                            ) {
                                              tryAssignStudent(
                                                item.id,
                                                selectedStudentId,
                                                group._id,
                                              );
                                            }
                                          }}
                                          onKeyDown={(event) => {
                                            if (
                                              (event.key === "Delete" ||
                                                event.key === "Backspace") &&
                                              slotAssignment &&
                                              canManage &&
                                              !archived
                                            ) {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              applyAssignments(
                                                unassignDeskSlot(assignments, item.id, group._id),
                                              );
                                            }
                                          }}
                                        >
                                          <span className="min-w-0 flex-1 truncate text-[6px] font-medium leading-tight">
                                            {displayName}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1.5 text-center">
                              <span className="line-clamp-2 text-[6px] text-muted-foreground">
                                {seatItemDisplayLabel(item, itemDefaults)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 border-t p-4 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">{t("chartRosterTitle")}</div>
            <HelpTip title={t("chartRosterTitle")} description={t("chartRosterHelp")} />
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[cohort]}
            onValueChange={(values) => {
              const next = values[0] as SeatChartCohortFilter | undefined;
              if (next) setCohort(next);
            }}
            className="flex-wrap"
          >
            <ToggleGroupItem value="class">{t("chartCohortClass")}</ToggleGroupItem>
            <ToggleGroupItem value="group">{t("chartCohortGroup")}</ToggleGroupItem>
            <ToggleGroupItem value="team">{t("chartCohortTeam")}</ToggleGroupItem>
          </ToggleGroup>
          {cohort !== "class" ? <GroupTeamFilterButtons classId={classId} /> : null}
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {visibleStudents.map((student) => {
              const displayName = getRosterDisplayName(student, unnamed, nameFormat);
              const seated = byStudent.has(student.userId);
              return (
                <li key={student.userId}>
                  <button
                    type="button"
                    draggable={canManage && !archived}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/x-seat-chart-student",
                        student.userId,
                      );
                      setDragStudentId(student.userId);
                    }}
                    onDragEnd={() => setDragStudentId(null)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent/40",
                      selectedStudentId === student.userId && "ring-2 ring-primary",
                    )}
                    onClick={() => {
                      setSelectedStudentId(student.userId);
                      const assignment = byStudent.get(student.userId);
                      if (assignment) {
                        setSelectedDeskId(assignment.deskItemId);
                        setSelectedSlot({
                          deskId: assignment.deskItemId,
                          groupId: assignment.groupId,
                        });
                      }
                      if (selectedSlot && canManage && !archived && !assignment) {
                        tryAssignStudent(selectedSlot.deskId, student.userId, selectedSlot.groupId);
                      }
                    }}
                  >
                    <span className="truncate">{displayName}</span>
                    {seated ? <Badge variant="secondary">{t("chartSeatedBadge")}</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedStudentId ? (
            <SeatChartStudentInspector
              classId={classId}
              chartId={chartId}
              studentUserId={selectedStudentId}
              studentName={getRosterDisplayName(
                roster?.find((s) => s.userId === selectedStudentId) ?? {
                  userId: selectedStudentId,
                },
                unnamed,
                nameFormat,
              )}
              violations={violationsForStudent(liveViolations, selectedStudentId)}
              onOpenRecord={setRecordViewerId}
            />
          ) : null}
        </aside>
      </div>

      <SeatChartRecordConfirmCredenza
        open={recordOpen}
        onOpenChange={setRecordOpen}
        seatedCount={seatedCount}
        unseatedCount={unseatedCount}
        violations={violations}
        pending={recordSeating.isPending}
        onConfirm={handleRecord}
      />

      <SeatChartRecordViewerCredenza
        classId={classId}
        recordId={recordViewerId}
        open={recordViewerId !== null}
        onOpenChange={(open) => {
          if (!open) setRecordViewerId(null);
        }}
      />

      <SeatLayoutUnsavedChangesDialog
        open={blocker.status === "blocked"}
        saving={saveDraft.isPending}
        onCancel={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
        onSaveAndLeave={async () => {
          await handleSave();
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
