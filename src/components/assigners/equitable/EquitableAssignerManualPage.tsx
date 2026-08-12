import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cpu, Redo2, RotateCcw, Save, ShuffleIcon, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EquitableAssignerStudentInspector } from "@/components/assigners/equitable/EquitableAssignerStudentInspector";
import { EquitableGenderBucketsField } from "@/components/assigners/equitable/EquitableGenderBucketsField";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { SeatLayoutUnsavedChangesDialog } from "@/components/assigners/SeatLayoutUnsavedChangesDialog";
import { RosterStudentChip } from "@/components/students/RosterStudentChip";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Credenza,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useCreateEquitableManualRun } from "@/hooks/assigners/equitable/useCreateEquitableManualRun";
import { useEquitableManualSetup } from "@/hooks/assigners/equitable/useEquitableManualSetup";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useCan } from "@/hooks/permissions/useCan";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import {
  assignmentsComplete,
  assignmentMap,
  assignmentsEqual,
  assignStudentToSlot,
  equitableAssignRemaining,
  hasEquitableAssignableRemaining,
  hasRandomAssignableRemaining,
  randomAssignRemaining,
  studentEligibleForSlot,
  unassignStudent,
  type EquitableManualDraftAssignment,
  type EquitableManualSlot,
  type EquitableManualStudent,
} from "@/lib/assigners/equitableManual";
import type { EquitableAssignerScope } from "@/lib/assigners/equitableAssigners";
import {
  formatEquitableGenderBucketLabel,
  equitableGenderBucketsEqual,
  normalizeEquitableGenderBuckets,
  type EquitableGenderBucket,
} from "@/lib/assigners/equitableAssigners";
import type { MembershipByUserId } from "@/lib/groups/groupTeamFilters";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerManualPageProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
};

type AssignmentSnapshot = { assignments: EquitableManualDraftAssignment[] };

type PendingRunOptions = {
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  genderBuckets: EquitableGenderBucket[];
};

function cloneSnapshot(snapshot: AssignmentSnapshot): AssignmentSnapshot {
  return { assignments: snapshot.assignments.map((row) => ({ ...row })) };
}

function parseDropId(
  overId: string | number | undefined,
): { kind: "slot"; slotId: string } | { kind: "tray" } | null {
  if (typeof overId !== "string") return null;
  if (overId === "tray:unassigned") return { kind: "tray" };
  if (overId.startsWith("slot:")) return { kind: "slot", slotId: overId.slice("slot:".length) };
  return null;
}

type ManualStudentChipProps = {
  student: EquitableManualStudent;
  canDrag: boolean;
  hidden?: boolean;
  isSelf?: boolean;
  selected?: boolean;
  assigned?: boolean;
  displayName: string;
  onSelect?: () => void;
};

function ManualStudentChip({
  student,
  canDrag,
  hidden = false,
  isSelf = false,
  selected = false,
  assigned = false,
  displayName,
  onSelect,
}: ManualStudentChipProps) {
  const { t } = useTranslation("assigners");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `student:${student.userId}`,
    data: { studentUserId: student.userId },
    disabled: !canDrag,
  });
  const invisiblyHeld = isDragging || hidden;

  return (
    <RosterStudentChip
      ref={setNodeRef}
      userId={student.userId}
      displayName={displayName}
      rosterNumber={student.rosterNumber}
      image={student.image}
      email={student.email}
      showGrip={canDrag}
      isSelf={isSelf}
      style={invisiblyHeld ? undefined : { transform: CSS.Translate.toString(transform) }}
      className={cn(
        canDrag && "cursor-grab active:cursor-grabbing",
        selected && "ring-2 ring-primary",
        invisiblyHeld && "opacity-0",
      )}
      trailing={
        assigned ? (
          <Badge variant="secondary" className="shrink-0">
            {t("equitableManualAssignedBadge")}
          </Badge>
        ) : null
      }
      render={
        <button
          type="button"
          onClick={onSelect}
          {...(canDrag ? { ...listeners, ...attributes } : {})}
        />
      }
    />
  );
}

type ManualSlotProps = {
  slot: EquitableManualSlot;
  student: EquitableManualStudent | null;
  displayName: string;
  canManage: boolean;
  selected: boolean;
  onSelect: () => void;
  onStudentSelect: () => void;
};

function ManualSlot({
  slot,
  student,
  displayName,
  canManage,
  selected,
  onSelect,
  onStudentSelect,
}: ManualSlotProps) {
  const { t } = useTranslation("assigners");
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.id}`,
    data: { slotId: slot.id },
    disabled: !canManage,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-14 w-full flex-col gap-1 rounded-lg border border-dashed p-2 text-left transition-colors",
        isOver && canManage && "border-primary bg-primary/5",
        selected && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex flex-wrap items-center gap-1 text-left",
          canManage && "hover:text-foreground",
        )}
        onClick={onSelect}
      >
        <span className="text-xs font-medium">{slot.item}</span>
        {slot.groupName ? (
          <span className="text-[10px] text-muted-foreground">({slot.groupName})</span>
        ) : null}
        {slot.genderRequired ? (
          <Badge variant="outline" className="h-5 px-1 text-[10px]">
            {formatEquitableGenderBucketLabel(slot.genderRequired, t)}
          </Badge>
        ) : null}
      </button>
      {student ? (
        <ManualStudentChip
          student={student}
          canDrag={canManage}
          displayName={displayName}
          assigned
          onSelect={onStudentSelect}
        />
      ) : (
        <span className="text-xs text-muted-foreground">{t("equitableManualSlotEmpty")}</span>
      )}
    </div>
  );
}

export function EquitableAssignerManualPage({
  classId,
  assignerId,
}: EquitableAssignerManualPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: classDoc } = useClass(classId);
  const { data: currentUser } = useCurrentUser();
  const filterState = useGroupTeamFilterState(classId);
  const createManualRun = useCreateEquitableManualRun();

  const [scope, setScope] = useState<EquitableAssignerScope>("class");
  const [balanceGender, setBalanceGender] = useState(false);
  const [genderBuckets, setGenderBuckets] = useState<EquitableGenderBucket[]>([]);
  const [optionsHydrated, setOptionsHydrated] = useState(false);
  const [assignments, setAssignments] = useState<EquitableManualDraftAssignment[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"users"> | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<Id<"users"> | null>(null);
  const [hiddenStudentId, setHiddenStudentId] = useState<Id<"users"> | null>(null);
  const [pendingOptions, setPendingOptions] = useState<PendingRunOptions | null>(null);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const baselineRef = useRef<AssignmentSnapshot | null>(null);
  const pastRef = useRef<AssignmentSnapshot[]>([]);
  const futureRef = useRef<AssignmentSnapshot[]>([]);
  const dirtyNavRef = useRef(false);
  dirtyNavRef.current = dirty;

  const {
    data: setup,
    isPending,
    isError,
    refetch,
  } = useEquitableManualSetup(classId, assignerId, scope, balanceGender, genderBuckets);

  useLogClassAccessOnce(
    setup !== undefined,
    setup
      ? {
          classId,
          resourceType: "roster",
          resourceId: assignerId,
          summary: `Opened manual equitable assigner "${setup.assigner.name}"`,
          summaryKey: "activitySummary_viewedEquitableManualEditor",
          metadata: { name: setup.assigner.name },
        }
      : null,
  );

  useEffect(() => {
    if (!setup || optionsHydrated) return;
    setScope(setup.assigner.defaultScope);
    setBalanceGender(setup.assigner.defaultBalanceGender);
    setGenderBuckets(normalizeEquitableGenderBuckets(setup.assigner.defaultGenderBuckets));
    setOptionsHydrated(true);
  }, [optionsHydrated, setup]);

  const setupAssignerId = setup?.assigner._id;
  const setupSlots = setup?.slots;

  useEffect(() => {
    if (setupAssignerId === undefined || setupSlots === undefined) return;
    const snapshot = { assignments: [] as EquitableManualDraftAssignment[] };
    baselineRef.current = cloneSnapshot(snapshot);
    pastRef.current = [];
    futureRef.current = [];
    setAssignments([]);
    setDirty(false);
    setCanUndo(false);
    setCanRedo(false);
  }, [setupAssignerId, setupSlots, scope, balanceGender, genderBuckets]);

  useEffect(() => {
    if (!baselineRef.current) return;
    setDirty(!assignmentsEqual(assignments, baselineRef.current.assignments));
  }, [assignments]);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = t("constraintUnknownStudent");

  const studentById = useMemo(
    () => new Map((setup?.students ?? []).map((student) => [student.userId, student])),
    [setup?.students],
  );

  const slotById = useMemo(
    () => new Map((setup?.slots ?? []).map((slot) => [slot.id, slot])),
    [setup?.slots],
  );

  const slotAssignments = useMemo(() => assignmentMap(assignments), [assignments]);
  const assignedStudentIds = useMemo(
    () => new Set(assignments.map((row) => row.studentUserId)),
    [assignments],
  );

  const membershipByUserId = useMemo(() => {
    const index: MembershipByUserId = {};
    for (const student of setup?.students ?? []) {
      index[student.userId] = student.groupId ? { groupId: student.groupId } : {};
    }
    return index;
  }, [setup?.students]);

  const rosterMembers = useMemo(
    () =>
      (setup?.students ?? []).map((student) => ({
        userId: student.userId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        name: student.displayName,
      })),
    [setup?.students],
  );

  const { filtered: visibleStudents } = useStudentRosterFilter({
    members: rosterMembers,
    query: "",
    membershipByUserId,
    filterState,
  });

  const visibleStudentIds = useMemo(
    () => new Set(visibleStudents.map((student) => student.userId)),
    [visibleStudents],
  );

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const applyAssignments = useCallback(
    (next: EquitableManualDraftAssignment[], pushHistory = true) => {
      if (pushHistory) {
        pastRef.current = [...pastRef.current, cloneSnapshot({ assignments })].slice(-50);
        futureRef.current = [];
      }
      setAssignments(next);
      syncHistoryFlags();
    },
    [assignments, syncHistoryFlags],
  );

  const tryAssignStudent = useCallback(
    (slotId: string, studentUserId: Id<"users">) => {
      const slot = slotById.get(slotId);
      const student = studentById.get(studentUserId);
      if (!slot || !student) return;
      if (!studentEligibleForSlot(student, slot, scope)) return;
      applyAssignments(assignStudentToSlot(assignments, slotId, studentUserId));
      setSelectedStudentId(studentUserId);
      setSelectedSlotId(slotId);
    },
    [applyAssignments, assignments, scope, slotById, studentById],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const studentUserId = event.active.data.current?.studentUserId as Id<"users"> | undefined;
    if (!studentUserId) return;
    setActiveStudentId(studentUserId);
    setHiddenStudentId(studentUserId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const studentUserId = event.active.data.current?.studentUserId as Id<"users"> | undefined;
      setActiveStudentId(null);
      setHiddenStudentId(null);
      if (!canManage || !studentUserId || !event.over) return;

      const target = parseDropId(event.over.id);
      if (!target) return;

      if (target.kind === "tray") {
        applyAssignments(unassignStudent(assignments, studentUserId));
        return;
      }

      tryAssignStudent(target.slotId, studentUserId);
    },
    [applyAssignments, assignments, canManage, tryAssignStudent],
  );

  const requestOptionsChange = useCallback(
    (next: PendingRunOptions) => {
      if (
        next.scope === scope &&
        next.balanceGender === balanceGender &&
        equitableGenderBucketsEqual(next.genderBuckets, genderBuckets)
      )
        return;
      if (dirty) {
        setPendingOptions(next);
        setOptionsDialogOpen(true);
        return;
      }
      setScope(next.scope);
      setBalanceGender(next.balanceGender);
      setGenderBuckets(next.genderBuckets);
      setAssignments([]);
      setSelectedStudentId(null);
      setSelectedSlotId(null);
    },
    [balanceGender, dirty, genderBuckets, scope],
  );

  const confirmOptionsChange = useCallback(() => {
    if (!pendingOptions) return;
    setScope(pendingOptions.scope);
    setBalanceGender(pendingOptions.balanceGender);
    setGenderBuckets(pendingOptions.genderBuckets);
    setAssignments([]);
    setSelectedStudentId(null);
    setSelectedSlotId(null);
    setPendingOptions(null);
    setOptionsDialogOpen(false);
    baselineRef.current = { assignments: [] };
    setDirty(false);
  }, [pendingOptions]);

  const handleSave = useCallback(async () => {
    if (!setup || !canManage) return;
    if (!assignmentsComplete(setup.slots, assignments)) return;
    const runId = await createManualRun.mutateAsync({
      classId,
      assignerId,
      scope,
      balanceGender,
      genderBuckets,
      assignments,
    });
    baselineRef.current = cloneSnapshot({ assignments });
    dirtyNavRef.current = false;
    setDirty(false);
    await navigate({
      to: "/class/$classId/assigners/equitable/$assignerId/dashboard",
      params: { classId, assignerId },
      search: { previewRunId: runId },
    });
  }, [
    assignerId,
    assignments,
    balanceGender,
    genderBuckets,
    canManage,
    classId,
    createManualRun,
    navigate,
    scope,
    setup,
  ]);

  const shouldBlockNavigation = useCallback(() => dirtyNavRef.current, []);

  const blocker = useBlocker({
    shouldBlockFn: shouldBlockNavigation,
    withResolver: true,
    enableBeforeUnload: () => dirtyNavRef.current,
  });

  const slotsByGroup = useMemo(() => {
    const groups = new Map<string, EquitableManualSlot[]>();
    for (const slot of setup?.slots ?? []) {
      const key = slot.groupId ?? "__class__";
      const rows = groups.get(key) ?? [];
      rows.push(slot);
      groups.set(key, rows);
    }
    return groups;
  }, [setup?.slots]);

  const selectedDraftSlotId =
    selectedSlotId ??
    (selectedStudentId
      ? assignments.find((row) => row.studentUserId === selectedStudentId)?.slotId
      : undefined);

  const saveEnabled =
    setup !== undefined && assignmentsComplete(setup.slots, assignments) && canManage;

  const canAssignEquitable =
    setup !== undefined &&
    hasEquitableAssignableRemaining({
      slots: setup.slots,
      students: setup.students,
      assignments,
      scope,
    });

  const canAssignRandom =
    setup !== undefined &&
    hasRandomAssignableRemaining({
      slots: setup.slots,
      students: setup.students,
      assignments,
      scope,
    });

  if (!canManage) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <ErrorState
          title={t("equitableManualPermissionDenied")}
          description={t("equitableManualPermissionDeniedDescription")}
        />
      </div>
    );
  }

  if (isPending || !setup) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[60vh] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <ErrorState
          title={t("equitableManualLoadFailed")}
          description={t("equitableManualLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const activeStudent = activeStudentId ? studentById.get(activeStudentId) : null;
  const activeDisplayName = activeStudent
    ? getRosterDisplayName(activeStudent, unnamed, nameFormat)
    : "";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100dvh-4rem)] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <Link
                  to="/class/$classId/assigners/equitable/$assignerId/dashboard"
                  params={{ classId, assignerId }}
                />
              }
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">
                {t("equitableManualTitle", { name: setup.assigner.name })}
              </h1>
              <p className="text-sm text-muted-foreground">{t("equitableManualDescription")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? <Badge variant="outline">{t("editorSaveStatusUnsaved")}</Badge> : null}
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!canUndo}
              onClick={() => {
                const previous = pastRef.current.at(-1);
                if (!previous) return;
                pastRef.current = pastRef.current.slice(0, -1);
                futureRef.current = [cloneSnapshot({ assignments }), ...futureRef.current];
                setAssignments(previous.assignments.map((row) => ({ ...row })));
                syncHistoryFlags();
              }}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!canRedo}
              onClick={() => {
                const next = futureRef.current[0];
                if (!next) return;
                futureRef.current = futureRef.current.slice(1);
                pastRef.current = [...pastRef.current, cloneSnapshot({ assignments })];
                setAssignments(next.assignments.map((row) => ({ ...row })));
                syncHistoryFlags();
              }}
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={t("equitableManualReset")}
              onClick={() => {
                applyAssignments([]);
                setSelectedStudentId(null);
                setSelectedSlotId(null);
              }}
              className="max-lg:size-8 max-lg:gap-0 max-lg:px-0 max-lg:has-data-[icon=inline-start]:pl-0"
            >
              <RotateCcw data-icon="inline-start" className="size-4" />
              <span className="hidden lg:inline">{t("equitableManualReset")}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAssignEquitable}
              aria-label={t("equitableManualFillRemaining")}
              onClick={() => {
                if (!setup) return;
                applyAssignments(
                  equitableAssignRemaining({
                    items: setup.assigner.items,
                    slots: setup.slots,
                    students: setup.students,
                    assignments,
                    scope,
                    balanceGender,
                    genderBuckets,
                    priorAssignments: setup.priorAssignments,
                  }),
                );
              }}
              className="max-lg:size-8 max-lg:gap-0 max-lg:px-0 max-lg:has-data-[icon=inline-start]:pl-0"
            >
              <Cpu data-icon="inline-start" className="size-4" />
              <span className="hidden lg:inline">{t("equitableManualFillRemaining")}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAssignRandom}
              aria-label={t("equitableManualAssignRandom")}
              onClick={() => {
                if (!setup) return;
                applyAssignments(
                  randomAssignRemaining({
                    slots: setup.slots,
                    students: setup.students,
                    assignments,
                    scope,
                  }),
                );
              }}
              className="max-lg:size-8 max-lg:gap-0 max-lg:px-0 max-lg:has-data-[icon=inline-start]:pl-0"
            >
              <ShuffleIcon data-icon="inline-start" className="size-4" />
              <span className="hidden lg:inline">{t("equitableManualAssignRandom")}</span>
            </Button>
            <AsyncButton
              type="button"
              size="sm"
              disabled={!saveEnabled}
              pending={createManualRun.isPending}
              aria-label={t("equitableManualSaveRun")}
              onClick={() => void handleSave()}
              className="max-lg:size-8 max-lg:gap-0 max-lg:px-0 max-lg:has-data-[icon=inline-start]:pl-0"
            >
              <Save data-icon="inline-start" className="size-4" />
              <span className="hidden lg:inline">{t("equitableManualSaveRun")}</span>
            </AsyncButton>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(16rem,42%)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("equitableRunScopeLabel")}</FieldLabel>
                <Select
                  value={scope}
                  onValueChange={(value) =>
                    requestOptionsChange({
                      scope: value as EquitableAssignerScope,
                      balanceGender,
                      genderBuckets,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {scope === "groups" ? t("equitableScopeGroups") : t("equitableScopeClass")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">{t("equitableScopeClass")}</SelectItem>
                    <SelectItem value="groups">{t("equitableScopeGroups")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal" className="items-center">
                <Checkbox
                  id="manual-balance-gender"
                  checked={balanceGender}
                  onCheckedChange={(checked) =>
                    requestOptionsChange({
                      scope,
                      balanceGender: checked === true,
                      genderBuckets,
                    })
                  }
                />
                <FieldLabel htmlFor="manual-balance-gender" className="font-normal">
                  {t("equitableBalanceGenderLabel")}
                </FieldLabel>
              </Field>
            </div>
            {balanceGender ? (
              <EquitableGenderBucketsField
                value={genderBuckets}
                onChange={(next) =>
                  requestOptionsChange({ scope, balanceGender, genderBuckets: next })
                }
                idPrefix="equitable-manual-gender"
              />
            ) : null}

            {scope === "groups" ? (
              Array.from(slotsByGroup.entries()).map(([groupKey, slots]) => {
                const groupName =
                  groupKey === "__class__"
                    ? t("equitableScopeClass")
                    : (setup.groups.find((group) => group.groupId === groupKey)?.groupName ?? "");
                return (
                  <section key={groupKey} className="flex flex-col gap-2">
                    <h2 className="text-sm font-medium">{groupName}</h2>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {slots.map((slot) => {
                        const studentId = slotAssignments.get(slot.id);
                        const student = studentId ? studentById.get(studentId) : null;
                        return (
                          <ManualSlot
                            key={slot.id}
                            slot={slot}
                            student={student ?? null}
                            displayName={
                              student ? getRosterDisplayName(student, unnamed, nameFormat) : unnamed
                            }
                            canManage={canManage}
                            selected={selectedSlotId === slot.id}
                            onSelect={() => {
                              setSelectedSlotId(slot.id);
                              if (selectedStudentId && !studentId) {
                                tryAssignStudent(slot.id, selectedStudentId);
                              } else if (studentId) {
                                setSelectedStudentId(studentId);
                              }
                            }}
                            onStudentSelect={() => {
                              if (studentId) setSelectedStudentId(studentId);
                              setSelectedSlotId(slot.id);
                            }}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {setup.slots.map((slot) => {
                  const studentId = slotAssignments.get(slot.id);
                  const student = studentId ? studentById.get(studentId) : null;
                  return (
                    <ManualSlot
                      key={slot.id}
                      slot={slot}
                      student={student ?? null}
                      displayName={
                        student ? getRosterDisplayName(student, unnamed, nameFormat) : unnamed
                      }
                      canManage={canManage}
                      selected={selectedSlotId === slot.id}
                      onSelect={() => {
                        setSelectedSlotId(slot.id);
                        if (selectedStudentId && !studentId) {
                          tryAssignStudent(slot.id, selectedStudentId);
                        } else if (studentId) {
                          setSelectedStudentId(studentId);
                        }
                      }}
                      onStudentSelect={() => {
                        if (studentId) setSelectedStudentId(studentId);
                        setSelectedSlotId(slot.id);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col gap-3 overflow-hidden border-t p-4 lg:border-t-0 lg:border-l">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <div className="text-sm font-medium">{t("equitableManualRosterTitle")}</div>
              <GroupTeamFilterButtons classId={classId} compact />
            </div>

            <div
              className={cn(
                "grid min-h-0 flex-1 basis-0 gap-3",
                selectedStudentId
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[minmax(0,1fr)_minmax(8rem,40%)]"
                  : "grid-cols-1",
              )}
            >
              <UnassignedTray
                canManage={canManage}
                hiddenStudentId={hiddenStudentId}
                viewerUserId={currentUser?._id ?? null}
              >
                <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {(setup.students ?? [])
                    .filter((student) => !assignedStudentIds.has(student.userId))
                    .filter((student) => visibleStudentIds.has(student.userId))
                    .map((student) => (
                      <li key={student.userId}>
                        <ManualStudentChip
                          student={student}
                          canDrag={canManage}
                          hidden={hiddenStudentId === student.userId}
                          isSelf={currentUser?._id === student.userId}
                          selected={selectedStudentId === student.userId}
                          displayName={getRosterDisplayName(student, unnamed, nameFormat)}
                          onSelect={() => {
                            setSelectedStudentId(student.userId);
                            if (selectedSlotId) {
                              tryAssignStudent(selectedSlotId, student.userId);
                            }
                          }}
                        />
                      </li>
                    ))}
                </ul>
              </UnassignedTray>

              {selectedStudentId ? (
                <div className="flex min-h-0 flex-col overflow-hidden">
                  <EquitableAssignerStudentInspector
                    classId={classId}
                    assignerId={assignerId}
                    studentUserId={selectedStudentId}
                    studentName={getRosterDisplayName(
                      studentById.get(selectedStudentId) ?? {
                        userId: selectedStudentId,
                      },
                      unnamed,
                      nameFormat,
                    )}
                    scope={scope}
                    balanceGender={balanceGender}
                    genderBuckets={genderBuckets}
                    draftSlotId={selectedDraftSlotId}
                  />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <DragOverlay>
        {activeStudent ? (
          <RosterStudentChip
            userId={activeStudent.userId}
            displayName={activeDisplayName}
            rosterNumber={activeStudent.rosterNumber}
            image={activeStudent.image}
            email={activeStudent.email}
            showGrip
            className="shadow-lg"
          />
        ) : null}
      </DragOverlay>

      <Credenza open={optionsDialogOpen} onOpenChange={setOptionsDialogOpen}>
        <CredenzaContent className="sm:max-w-md">
          <CredenzaHeader>
            <CredenzaTitle>{t("equitableManualOptionsChangeTitle")}</CredenzaTitle>
            <CredenzaDescription>
              {t("equitableManualOptionsChangeDescription")}
            </CredenzaDescription>
          </CredenzaHeader>
          <CredenzaFooter className="flex-row justify-end gap-2">
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("equitableCancel")}
            </CredenzaClose>
            <Button type="button" onClick={confirmOptionsChange}>
              {t("equitableManualOptionsChangeConfirm")}
            </Button>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>

      <SeatLayoutUnsavedChangesDialog
        open={blocker.status === "blocked"}
        saving={createManualRun.isPending}
        onDiscard={() => blocker.proceed?.()}
        onSaveAndLeave={async () => {
          if (!saveEnabled) {
            blocker.reset?.();
            return;
          }
          await handleSave();
          blocker.reset?.();
        }}
        onCancel={() => blocker.reset?.()}
      />
    </DndContext>
  );
}

function UnassignedTray({
  children,
  canManage,
  hiddenStudentId: _hiddenStudentId,
  viewerUserId: _viewerUserId,
}: {
  children: ReactNode;
  canManage: boolean;
  hiddenStudentId: Id<"users"> | null;
  viewerUserId: Id<"users"> | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "tray:unassigned",
    disabled: !canManage,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 flex-col gap-2 rounded-xl border border-dashed p-2",
        isOver && canManage && "border-primary bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}
