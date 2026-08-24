import {
  CheckIcon,
  LayoutGridIcon,
  PencilIcon,
  SearchIcon,
  TableIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { ChangeMemberRoleConfirmDialog } from "@/components/members/ChangeMemberRoleConfirmDialog";
import { RemoveMemberCredenza } from "@/components/members/RemoveMemberCredenza";
import { RosterNameFormatControls } from "@/components/students/RosterNameFormatControls";
import { StudentRosterCard } from "@/components/students/StudentRosterCard";
import { StudentRosterTable } from "@/components/students/StudentRosterTable";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useSetRosterNameFormat } from "@/hooks/classes/useSetRosterNameFormat";
import { useCan } from "@/hooks/permissions/useCan";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useChangeMemberRoleWithConfirm } from "@/hooks/members/useChangeMemberRoleWithConfirm";
import { useRemoveClassMember } from "@/hooks/members/useRemoveClassMember";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useReorderStudentRoster } from "@/hooks/roster/useReorderStudentRoster";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useUpdateStudentRosterFields } from "@/hooks/roster/useUpdateStudentRosterFields";
import { useUpsertStudentsViewPrefs } from "@/hooks/roster/useUpsertStudentsViewPrefs";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import { buildMembershipIndex, hasGroupTeamMembershipFilters } from "@/lib/groups/groupTeamFilters";
import type { JoinCodeRole } from "@/lib/members/members";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  applyRosterOrder,
  getRosterDisplayName,
  normalizeColumnOrder,
  normalizeColumnVisibility,
  resolveRosterNameFormat,
  type GenderOption,
  type PronounOption,
  type RosterColumnId,
  type RosterNameFormat,
  type StudentRosterEntry,
  type StudentsViewMode,
} from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

type StudentsPageProps = {
  classId: Id<"classes">;
};

function StudentsSkeleton({ viewMode }: { viewMode: StudentsViewMode }) {
  if (viewMode === "table") {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function StudentsPage({ classId }: StudentsPageProps) {
  const { t } = useTranslation("classes");
  const { data: currentUser } = useCurrentUser();
  const { can, isPending: permissionsPending } = useCan();
  const canUpdateRoster = !permissionsPending && can("students:update");
  const canUpdateClass = !permissionsPending && can("class:update");

  const { data, isPending, isError, refetch, isAuthLoading } = useStudentRoster(classId);
  // Share `classes.get` cache without the access-log side effect from `useClass`.
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data: settings } = useClassUserSettings(classId);
  const { data: groupsBoard } = useGroupsBoard(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  useEnsureStudentRosters(classId, !isPending && !isAuthLoading && !isError);

  const removeMutation = useRemoveClassMember("student");
  const {
    requestRoleChange,
    confirmPendingRoleChange,
    confirmOpen,
    handleConfirmOpenChange,
    pendingMemberName,
  } = useChangeMemberRoleWithConfirm(classId);
  const updateFieldsMutation = useUpdateStudentRosterFields();
  const reorderMutation = useReorderStudentRoster();
  const upsertPrefsMutation = useUpsertStudentsViewPrefs();
  const setRosterNameFormat = useSetRosterNameFormat();

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const handleNameFormatChange = useCallback(
    (next: RosterNameFormat) => {
      if (next.order === nameFormat.order && next.space === nameFormat.space) {
        return;
      }
      setRosterNameFormat.mutate({
        classId,
        rosterNameOrder: next.order,
        rosterNameSpace: next.space,
      });
    },
    [classId, nameFormat.order, nameFormat.space, setRosterNameFormat],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [tableEditMode, setTableEditMode] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<Id<"users">[] | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<StudentRosterEntry | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const viewMode: StudentsViewMode = settings?.studentsViewMode ?? "grid";
  const columnOrder = useMemo(
    () => normalizeColumnOrder(settings?.studentsColumnOrder),
    [settings?.studentsColumnOrder],
  );
  const columnVisibility = useMemo(
    () => normalizeColumnVisibility(settings?.studentsColumnVisibility),
    [settings?.studentsColumnVisibility],
  );

  const students = useMemo(() => data ?? [], [data]);
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
    query: searchQuery,
    membershipByUserId,
    filterState,
  });
  const membershipFiltersActive = hasGroupTeamMembershipFilters(filterState);
  const searchActive = searchQuery.trim().length > 0;
  const listFiltered = searchActive || membershipFiltersActive;

  // Row reorder must include every student; leave table layout editing while filtered.
  useEffect(() => {
    if (listFiltered && tableEditMode) {
      setTableEditMode(false);
      setPendingOrderIds(null);
    }
  }, [listFiltered, tableEditMode]);

  useEffect(() => {
    if (!pendingOrderIds) return;
    const idSet = new Set(students.map((entry) => entry.userId));
    if (
      pendingOrderIds.length !== students.length ||
      pendingOrderIds.some((userId) => !idSet.has(userId))
    ) {
      setPendingOrderIds(null);
    }
  }, [pendingOrderIds, students]);

  const isOrderDirty = useMemo(() => {
    if (!pendingOrderIds) return false;
    if (pendingOrderIds.length !== students.length) return true;
    return pendingOrderIds.some((userId, index) => students[index]?.userId !== userId);
  }, [pendingOrderIds, students]);

  const tableStudents = useMemo(() => {
    if (!pendingOrderIds || listFiltered) return filtered;
    return applyRosterOrder(students, pendingOrderIds) ?? filtered;
  }, [filtered, listFiltered, pendingOrderIds, students]);

  const handleViewModeChange = useCallback(
    (mode: StudentsViewMode) => {
      if (mode === viewMode) return;
      if (mode === "grid") {
        setTableEditMode(false);
        setPendingOrderIds(null);
      }
      void upsertPrefsMutation.mutateAsync({
        classId,
        studentsViewMode: mode,
      });
    },
    [classId, upsertPrefsMutation, viewMode],
  );

  const handleColumnOrderChange = useCallback(
    (order: RosterColumnId[]) => {
      void upsertPrefsMutation.mutateAsync({
        classId,
        studentsColumnOrder: order,
      });
    },
    [classId, upsertPrefsMutation],
  );

  const handleColumnVisibilityChange = useCallback(
    (visibility: Record<RosterColumnId, boolean>) => {
      void upsertPrefsMutation.mutateAsync({
        classId,
        studentsColumnVisibility: visibility,
      });
    },
    [classId, upsertPrefsMutation],
  );

  const handleReorderRows = useCallback((userIds: Id<"users">[]) => {
    setPendingOrderIds(userIds);
  }, []);

  const handleCancelTableEdit = useCallback(() => {
    setPendingOrderIds(null);
    setTableEditMode(false);
  }, []);

  const handleSaveTableEdit = useCallback(async () => {
    if (!pendingOrderIds || !isOrderDirty) {
      handleCancelTableEdit();
      return;
    }
    setTableEditMode(false);
    try {
      await reorderMutation.mutateAsync({ classId, userIds: pendingOrderIds });
      setPendingOrderIds(null);
    } catch {
      setTableEditMode(true);
    }
  }, [classId, handleCancelTableEdit, isOrderDirty, pendingOrderIds, reorderMutation]);

  const handleSaveRow = useCallback(
    (
      userId: Id<"users">,
      draft: {
        firstName: string | null;
        lastName: string | null;
        gender: GenderOption | null;
        genderSelfDescribe: string | null;
        pronouns: PronounOption | null;
        pronounsSelfDescribe: string | null;
      },
    ) => {
      updateFieldsMutation.mutate({
        classId,
        userId,
        ...draft,
      });
    },
    [classId, updateFieldsMutation],
  );

  const handleRemoveRequest = useCallback((student: StudentRosterEntry) => {
    setMemberToRemove(student);
    setRemoveOpen(true);
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!memberToRemove) return;
    await removeMutation.mutateAsync({
      classId,
      userId: memberToRemove.userId,
    });
  }, [classId, memberToRemove, removeMutation]);

  const handleChangeRole = useCallback(
    (student: StudentRosterEntry, nextRole: JoinCodeRole) => {
      void requestRoleChange(
        {
          userId: student.userId,
          name: student.name,
          email: student.email,
          image: student.image,
          role: "student",
        },
        nextRole,
      );
    },
    [requestRoleChange],
  );

  const removeMemberName = memberToRemove
    ? getRosterDisplayName(memberToRemove, t("unnamedMember"), nameFormat)
    : "";

  const showLoaded = !isPending && !isAuthLoading && !isError;
  const showSearch = showLoaded && (students.length > 0 || searchQuery.trim().length > 0);
  const showFilters = showLoaded && students.length > 0;
  const showEmpty = showLoaded && students.length === 0;
  const showNoMatches = showLoaded && students.length > 0 && filtered.length === 0;
  const showContent = showLoaded && filtered.length > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navStudents")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("rosterDescription")}</p>
        </div>

        {showLoaded ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {viewMode === "table" && canUpdateRoster ? (
                tableEditMode ? (
                  isOrderDirty ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={reorderMutation.isPending}
                        onClick={handleCancelTableEdit}
                      >
                        <XIcon data-icon="inline-start" />
                        {t("rosterCancelEditingTable")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={reorderMutation.isPending}
                        onClick={() => {
                          void handleSaveTableEdit();
                        }}
                      >
                        <CheckIcon data-icon="inline-start" />
                        {t("rosterSaveOrder")}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" onClick={handleCancelTableEdit}>
                      {t("rosterDoneEditingTable")}
                    </Button>
                  )
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={listFiltered || reorderMutation.isPending}
                    onClick={() => setTableEditMode(true)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    {t("rosterEditTable")}
                  </Button>
                )
              ) : null}

              <ToggleGroup
                variant="outline"
                spacing={0}
                value={[viewMode]}
                onValueChange={(values) => {
                  const next = values[0];
                  if (next === "grid" || next === "table") {
                    handleViewModeChange(next);
                  }
                }}
              >
                <ToggleGroupItem value="grid" aria-label={t("viewGrid")}>
                  <LayoutGridIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label={t("viewTable")}>
                  <TableIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {canUpdateClass ? (
              <RosterNameFormatControls
                variant="inline"
                value={nameFormat}
                onChange={handleNameFormatChange}
                disabled={setRosterNameFormat.isPending}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {showFilters ? <GroupTeamFilterButtons classId={classId} /> : null}

      {showSearch ? (
        <InputGroup className="max-w-md">
          <InputGroupInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("membersSearchPlaceholder")}
            aria-label={t("membersSearchLabel")}
            autoComplete="off"
            spellCheck={false}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <InputGroupText>{t("membersSearchResults", { count: filtered.length })}</InputGroupText>
            {searchQuery ? (
              <InputGroupButton
                size="icon-xs"
                aria-label={t("membersSearchClear")}
                onClick={() => setSearchQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            ) : null}
          </InputGroupAddon>
        </InputGroup>
      ) : null}

      {isPending || isAuthLoading ? <StudentsSkeleton viewMode={viewMode} /> : null}

      {!isPending && !isAuthLoading && isError ? (
        <ErrorState
          title={t("rosterLoadFailed")}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {showEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("membersEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("membersEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showNoMatches ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>{t("membersSearchNoResultsTitle")}</EmptyTitle>
            <EmptyDescription>{t("membersSearchNoResults")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {showContent && viewMode === "grid" ? (
        <div className={GRID_CLASS}>
          {filtered.map((student) => (
            <StudentRosterCard
              key={student.userId}
              student={student}
              isSelf={currentUser?._id === student.userId}
              nameFormat={nameFormat}
              onRemove={handleRemoveRequest}
              onChangeRole={handleChangeRole}
            />
          ))}
        </div>
      ) : null}

      {showContent && viewMode === "table" ? (
        <StudentRosterTable
          data={tableStudents}
          tableEditMode={tableEditMode}
          canUpdateRoster={canUpdateRoster}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={handleColumnOrderChange}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onReorderRows={handleReorderRows}
          onSaveRow={handleSaveRow}
          onRemove={handleRemoveRequest}
          onChangeRole={handleChangeRole}
          currentUserId={currentUser?._id}
        />
      ) : null}

      <RemoveMemberCredenza
        key={memberToRemove ? `remove:${memberToRemove.userId}` : "remove"}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        memberName={removeMemberName}
        onConfirm={handleRemoveConfirm}
      />

      <ChangeMemberRoleConfirmDialog
        open={confirmOpen}
        memberName={pendingMemberName}
        onOpenChange={handleConfirmOpenChange}
        onConfirm={confirmPendingRoleChange}
      />
    </div>
  );
}
