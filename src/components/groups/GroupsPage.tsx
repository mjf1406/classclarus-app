import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FileDown, Plus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CopyTeamCredenza } from "@/components/groups/CopyTeamCredenza";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupCard } from "@/components/groups/GroupCard";
import { GroupNamedFormCredenza } from "@/components/groups/GroupNamedFormCredenza";
import { MoveStudentsCredenza } from "@/components/groups/MoveStudentsCredenza";
import { StudentChip } from "@/components/groups/StudentChip";
import { StudentDropZone } from "@/components/groups/StudentDropZone";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { useClass } from "@/hooks/classes/useClass";
import { useAssignStudent } from "@/hooks/groups/useAssignStudent";
import { useAssignStudents } from "@/hooks/groups/useAssignStudents";
import { useCopyTeam } from "@/hooks/groups/useCopyTeam";
import { useCreateGroup } from "@/hooks/groups/useCreateGroup";
import { useCreateTeam } from "@/hooks/groups/useCreateTeam";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useRemoveGroup } from "@/hooks/groups/useRemoveGroup";
import { useRemoveTeam } from "@/hooks/groups/useRemoveTeam";
import { useUpdateGroup } from "@/hooks/groups/useUpdateGroup";
import { useUpdateTeam } from "@/hooks/groups/useUpdateTeam";
import { useCan } from "@/hooks/permissions/useCan";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import type { BoardGroup, BoardStudent, BoardTeam, DropTarget } from "@/lib/groups/groups";
import { findStudentOnBoard } from "@/lib/groups/groups";
import type { GroupFormSchemaValues } from "@/lib/groups/groupFormSchema";
import {
  buildGroupsPrintMatrix,
  groupsPrintLogoAlt,
  printGroupsMatrix,
} from "@/lib/groups/groupsPrint";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type GroupsPageProps = {
  classId: Id<"classes">;
};

type NamedFormState =
  | { kind: "group"; mode: "create" }
  | { kind: "group"; mode: "edit"; group: BoardGroup }
  | { kind: "team"; mode: "create"; groupId: Id<"groups"> }
  | { kind: "team"; mode: "edit"; team: BoardTeam };

type DeleteState = { kind: "group"; group: BoardGroup } | { kind: "team"; team: BoardTeam };

type CopyTeamState = {
  team: BoardTeam;
  sourceGroupId: Id<"groups">;
};

type MoveStudentsState = {
  group: BoardGroup;
};

const DROP_ANIMATION_MS = 200;

function GroupsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(14rem,18rem)_1fr]">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function parseDropTarget(overId: string | number | undefined): DropTarget | null {
  if (typeof overId !== "string") return null;
  if (overId === "ungrouped") return { kind: "ungrouped" };
  if (overId.startsWith("group:")) {
    return { kind: "group", groupId: overId.slice("group:".length) as Id<"groups"> };
  }
  if (overId.startsWith("team:")) {
    const teamId = overId.slice("team:".length) as Id<"teams">;
    return { kind: "team", groupId: "" as Id<"groups">, teamId };
  }
  return null;
}

export function GroupsPage({ classId }: GroupsPageProps) {
  const { t } = useTranslation("classes");
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("groups:manage");
  const { data, isPending, isError, refetch, isAuthLoading } = useGroupsBoard(classId);
  const { data: classDoc } = useClass(classId);
  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );
  const { data: currentUser } = useCurrentUser();
  const logAccess = useLogClassAccess();
  const [exportPending, setExportPending] = useState(false);
  const viewerUserId = currentUser?._id ?? null;
  const viewerOnBoard = useMemo(
    () => (data && viewerUserId ? findStudentOnBoard(data, viewerUserId) != null : false),
    [data, viewerUserId],
  );
  const viewerIsUngrouped = useMemo(
    () =>
      Boolean(
        data && viewerUserId && data.ungrouped.some((student) => student.userId === viewerUserId),
      ),
    [data, viewerUserId],
  );

  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const removeGroup = useRemoveGroup();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const removeTeam = useRemoveTeam();
  const copyTeam = useCopyTeam();
  const assignStudent = useAssignStudent();
  const assignStudents = useAssignStudents();

  const [formState, setFormState] = useState<NamedFormState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [copyTeamState, setCopyTeamState] = useState<CopyTeamState | null>(null);
  const [moveStudentsState, setMoveStudentsState] = useState<MoveStudentsState | null>(null);
  const [activeStudent, setActiveStudent] = useState<BoardStudent | null>(null);
  const [hiddenStudentId, setHiddenStudentId] = useState<Id<"users"> | null>(null);
  const overRectRef = useRef<{ left: number; top: number } | null>(null);
  const dropSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const clearDragVisuals = useCallback(() => {
    if (dropSettleTimeoutRef.current !== null) {
      clearTimeout(dropSettleTimeoutRef.current);
      dropSettleTimeoutRef.current = null;
    }
    setActiveStudent(null);
    setHiddenStudentId(null);
    overRectRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (dropSettleTimeoutRef.current !== null) {
        clearTimeout(dropSettleTimeoutRef.current);
      }
    };
  }, []);

  // Animate the overlay into the droppable instead of back to the drag origin.
  const dropAnimation = useMemo<DropAnimation>(
    () => ({
      duration: DROP_ANIMATION_MS,
      easing: "ease-out",
      keyframes({ transform: { initial }, dragOverlay }) {
        const over = overRectRef.current;
        if (!over) {
          return [
            { transform: CSS.Translate.toString(initial), opacity: "1" },
            { transform: CSS.Translate.toString(initial), opacity: "0" },
          ];
        }
        const final = {
          x: initial.x + over.left - dragOverlay.rect.left + 8,
          y: initial.y + over.top - dragOverlay.rect.top + 8,
          scaleX: 1,
          scaleY: 1,
        };
        return [
          { transform: CSS.Translate.toString(initial), opacity: "1" },
          { transform: CSS.Translate.toString(final), opacity: "0" },
        ];
      },
    }),
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!data) return;
      const studentUserId = event.active.data.current?.studentUserId as Id<"users"> | undefined;
      if (!studentUserId) return;
      if (dropSettleTimeoutRef.current !== null) {
        clearTimeout(dropSettleTimeoutRef.current);
        dropSettleTimeoutRef.current = null;
      }
      const found = findStudentOnBoard(data, studentUserId);
      setActiveStudent(found?.student ?? null);
      setHiddenStudentId(studentUserId);
    },
    [data],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const rect = event.over?.rect;
    overRectRef.current = rect ? { left: rect.left, top: rect.top } : null;
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const finishWithoutMove = () => {
        clearDragVisuals();
      };

      if (!canManage || !data) {
        finishWithoutMove();
        return;
      }
      const studentUserId = event.active.data.current?.studentUserId as Id<"users"> | undefined;
      if (!studentUserId || !event.over) {
        finishWithoutMove();
        return;
      }

      const overRect = event.over.rect;
      overRectRef.current = { left: overRect.left, top: overRect.top };

      const overData = event.over.data.current?.target as DropTarget | undefined;
      let target = overData ?? parseDropTarget(event.over.id);
      if (!target) {
        finishWithoutMove();
        return;
      }

      // Resolve groupId for team drops when only team id is in the over id.
      if (target.kind === "team" && !target.groupId) {
        const teamId = target.teamId;
        const group = data.groups.find((item) => item.teams.some((team) => team._id === teamId));
        if (!group) {
          finishWithoutMove();
          return;
        }
        target = { kind: "team", groupId: group._id, teamId };
      }

      const found = findStudentOnBoard(data, studentUserId);
      if (!found) {
        finishWithoutMove();
        return;
      }
      const from = found.from;
      const same =
        (from.kind === "ungrouped" && target.kind === "ungrouped") ||
        (from.kind === "group" && target.kind === "group" && from.groupId === target.groupId) ||
        (from.kind === "team" && target.kind === "team" && from.teamId === target.teamId);
      if (same) {
        finishWithoutMove();
        return;
      }

      assignStudent.mutate({ classId, studentUserId, target });
      // Keep overlay content + hide the settled chip until the drop animation finishes.
      dropSettleTimeoutRef.current = setTimeout(() => {
        dropSettleTimeoutRef.current = null;
        setActiveStudent(null);
        setHiddenStudentId(null);
        overRectRef.current = null;
      }, DROP_ANIMATION_MS);
    },
    [assignStudent, canManage, classId, clearDragVisuals, data],
  );

  const handleFormSubmit = useCallback(
    async (values: GroupFormSchemaValues) => {
      if (!formState) return;
      if (formState.kind === "group" && formState.mode === "create") {
        await createGroup.mutateAsync({
          classId,
          name: values.name,
          description: values.description,
          icon: values.icon,
          imageFileId: values.imageFileId,
        });
        return;
      }
      if (formState.kind === "group" && formState.mode === "edit") {
        await updateGroup.mutateAsync({
          classId,
          groupId: formState.group._id,
          name: values.name,
          description: values.description,
          icon: values.icon,
        });
        return;
      }
      if (formState.kind === "team" && formState.mode === "create") {
        await createTeam.mutateAsync({
          classId,
          groupId: formState.groupId,
          name: values.name,
          description: values.description,
          icon: values.icon,
          imageFileId: values.imageFileId,
          alsoCreateInGroupIds: values.alsoCreateInGroupIds,
        });
        return;
      }
      if (formState.kind === "team" && formState.mode === "edit") {
        await updateTeam.mutateAsync({
          classId,
          teamId: formState.team._id,
          name: values.name,
          description: values.description,
          icon: values.icon,
        });
      }
    },
    [classId, createGroup, createTeam, formState, updateGroup, updateTeam],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteState) return;
    if (deleteState.kind === "group") {
      await removeGroup.mutateAsync({ classId, groupId: deleteState.group._id });
      return;
    }
    await removeTeam.mutateAsync({ classId, teamId: deleteState.team._id });
  }, [classId, deleteState, removeGroup, removeTeam]);

  const handleCopyTeamConfirm = useCallback(
    async (targetGroupIds: Array<Id<"groups">>) => {
      if (!copyTeamState) return;
      await copyTeam.mutateAsync({
        classId,
        teamId: copyTeamState.team._id,
        sourceGroupId: copyTeamState.sourceGroupId,
        name: copyTeamState.team.name,
        description: copyTeamState.team.description,
        icon: copyTeamState.team.icon,
        imageFileId: copyTeamState.team.imageFileId,
        targetGroupIds,
      });
    },
    [classId, copyTeam, copyTeamState],
  );

  const handleMoveStudentsConfirm = useCallback(
    async (studentUserIds: Array<Id<"users">>) => {
      if (!moveStudentsState) return;
      await assignStudents.mutateAsync({
        classId,
        groupId: moveStudentsState.group._id,
        studentUserIds,
      });
    },
    [assignStudents, classId, moveStudentsState],
  );

  const formInitialValues =
    formState?.mode === "edit"
      ? formState.kind === "group"
        ? {
            name: formState.group.name,
            description: formState.group.description,
            icon: formState.group.icon,
            imageFileId: formState.group.imageFileId,
          }
        : {
            name: formState.team.name,
            description: formState.team.description,
            icon: formState.team.icon,
            imageFileId: formState.team.imageFileId,
          }
      : undefined;

  const formEditEntityId =
    formState?.mode === "edit"
      ? formState.kind === "group"
        ? formState.group._id
        : formState.team._id
      : undefined;

  const printMatrix = useMemo(
    () =>
      data
        ? buildGroupsPrintMatrix(data, {
            teamlessLabel: t("groupsNoTeamLabel"),
            nameFormat,
          })
        : null,
    [data, nameFormat, t],
  );
  const canExportPdf = Boolean(printMatrix && printMatrix.rows.length > 0);

  const handleExportPdf = useCallback(async () => {
    if (!data || !printMatrix || printMatrix.rows.length === 0) {
      toast.add({ type: "warning", title: t("groupsExportPdfEmpty") });
      return;
    }
    const className = classDoc?.name?.trim() || t("navGroups");
    const subtitle = t("groupsExportPdfSubtitle");
    setExportPending(true);
    try {
      await printGroupsMatrix(printMatrix, {
        documentTitle: `${className} — ${subtitle}`,
        heading: className,
        subtitle,
        teamColumnLabel: t("groupsExportPdfTeamColumn"),
        logoAlt: groupsPrintLogoAlt(),
      });
      logAccess.mutate({
        classId,
        resourceType: "groups",
        summary: "Exported groups PDF",
        summaryKey: "activitySummary_exportedGroupsPdf",
        metadata: {
          groupCount: String(printMatrix.groupNames.length),
          teamRowCount: String(printMatrix.rows.length),
        },
      });
    } catch {
      toast.add({ type: "error", title: t("groupsExportPdfFailed") });
    } finally {
      setExportPending(false);
    }
  }, [classDoc?.name, classId, data, logAccess, printMatrix, t]);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navGroups")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("groupsDescription")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canExportPdf || exportPending || isPending || isAuthLoading}
            onClick={() => {
              void handleExportPdf();
            }}
          >
            <FileDown data-icon="inline-start" />
            {exportPending ? t("groupsExportPdfPending") : t("groupsExportPdf")}
          </Button>
          {canManage ? (
            <Button type="button" onClick={() => setFormState({ kind: "group", mode: "create" })}>
              <Plus data-icon="inline-start" />
              {t("groupsCreateAction")}
            </Button>
          ) : null}
        </div>
      </div>

      {isPending || isAuthLoading ? <GroupsSkeleton /> : null}

      {isError ? (
        <ErrorState
          title={t("groupsLoadFailed")}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isPending && !isAuthLoading && !isError && data ? (
        data.groups.length === 0 && data.ungrouped.length === 0 ? (
          <Empty card>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>{t("groupsEmptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("groupsEmptyDescription")}</EmptyDescription>
            </EmptyHeader>
            {canManage ? (
              <EmptyContent>
                <Button
                  type="button"
                  onClick={() => setFormState({ kind: "group", mode: "create" })}
                >
                  <Plus className="size-4" />
                  {t("groupsCreateAction")}
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={clearDragVisuals}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(14rem,18rem)_1fr]">
              <aside
                className={cn(
                  "flex flex-col gap-2 rounded-2xl p-4 lg:sticky lg:top-4 lg:self-start",
                  viewerIsUngrouped
                    ? "bg-primary/5 ring-2 ring-primary/50"
                    : "bg-card ring-1 ring-foreground/10",
                )}
              >
                <h2 className="text-sm font-semibold">{t("groupsUngroupedTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("groupsUngroupedHint")}</p>
                <StudentDropZone
                  id="ungrouped"
                  target={{ kind: "ungrouped" }}
                  students={data.ungrouped}
                  canManage={canManage}
                  emptyLabel={t("groupsUngroupedEmpty")}
                  hiddenStudentId={hiddenStudentId}
                  viewerUserId={viewerOnBoard ? viewerUserId : null}
                  nameFormat={nameFormat}
                />
              </aside>

              {data.groups.length === 0 ? (
                <Empty card>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound />
                    </EmptyMedia>
                    <EmptyTitle>{t("groupsNoGroupsTitle")}</EmptyTitle>
                    <EmptyDescription>{t("groupsNoGroupsDescription")}</EmptyDescription>
                  </EmptyHeader>
                  {canManage ? (
                    <EmptyContent>
                      <Button
                        type="button"
                        onClick={() => setFormState({ kind: "group", mode: "create" })}
                      >
                        <Plus className="size-4" />
                        {t("groupsCreateAction")}
                      </Button>
                    </EmptyContent>
                  ) : null}
                </Empty>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.groups.map((group) => (
                    <GroupCard
                      key={group._id}
                      group={group}
                      canManage={canManage}
                      canCopyTeam={data.groups.length > 1}
                      hiddenStudentId={hiddenStudentId}
                      viewerUserId={viewerOnBoard ? viewerUserId : null}
                      nameFormat={nameFormat}
                      onEditGroup={(item) =>
                        setFormState({ kind: "group", mode: "edit", group: item })
                      }
                      onDeleteGroup={(item) => setDeleteState({ kind: "group", group: item })}
                      onMoveStudents={(item) => setMoveStudentsState({ group: item })}
                      onAddTeam={(groupId) =>
                        setFormState({ kind: "team", mode: "create", groupId })
                      }
                      onEditTeam={(_groupId, team) =>
                        setFormState({ kind: "team", mode: "edit", team })
                      }
                      onCopyTeam={(sourceGroupId, team) =>
                        setCopyTeamState({ team, sourceGroupId })
                      }
                      onDeleteTeam={(team) => setDeleteState({ kind: "team", team })}
                    />
                  ))}
                </div>
              )}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
              {activeStudent ? (
                <StudentChip
                  student={activeStudent}
                  canDrag={false}
                  isSelf={viewerUserId != null && activeStudent.userId === viewerUserId}
                  nameFormat={nameFormat}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )
      ) : null}

      {formState ? (
        <GroupNamedFormCredenza
          open
          onOpenChange={(open) => {
            if (!open) setFormState(null);
          }}
          classId={classId}
          kind={formState.kind}
          mode={formState.mode}
          alsoCreateInGroupOptions={
            formState.kind === "team" && formState.mode === "create"
              ? (data?.groups ?? [])
                  .filter((group) => group._id !== formState.groupId)
                  .map((group) => ({ value: group._id, label: group.name }))
              : undefined
          }
          initialValues={formInitialValues}
          editEntityId={formEditEntityId}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {deleteState ? (
        <DeleteNamedCredenza
          open
          onOpenChange={(open) => {
            if (!open) setDeleteState(null);
          }}
          title={
            deleteState.kind === "group"
              ? t("groupsDeleteConfirmTitle", { name: deleteState.group.name })
              : t("teamsDeleteConfirmTitle", { name: deleteState.team.name })
          }
          description={
            deleteState.kind === "group"
              ? t("groupsDeleteConfirmDescription", { name: deleteState.group.name })
              : t("teamsDeleteConfirmDescription", { name: deleteState.team.name })
          }
          confirmLabel={
            deleteState.kind === "group" ? t("groupsDeleteAction") : t("teamsDeleteAction")
          }
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {copyTeamState ? (
        <CopyTeamCredenza
          open
          onOpenChange={(open) => {
            if (!open) setCopyTeamState(null);
          }}
          teamName={copyTeamState.team.name}
          groupOptions={(data?.groups ?? [])
            .filter((group) => group._id !== copyTeamState.sourceGroupId)
            .map((group) => ({ value: group._id, label: group.name }))}
          onConfirm={handleCopyTeamConfirm}
        />
      ) : null}

      {moveStudentsState && data ? (
        <MoveStudentsCredenza
          open
          onOpenChange={(open) => {
            if (!open) setMoveStudentsState(null);
          }}
          groupId={moveStudentsState.group._id}
          groupName={moveStudentsState.group.name}
          board={data}
          nameFormat={nameFormat}
          groupOptions={data.groups
            .filter((group) => group._id !== moveStudentsState.group._id)
            .map((group) => ({ value: group._id, label: group.name }))}
          onConfirm={handleMoveStudentsConfirm}
        />
      ) : null}
    </div>
  );
}
