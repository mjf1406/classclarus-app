import { Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ExpectationCard } from "@/components/expectations/ExpectationCard";
import { ExpectationFormCredenza } from "@/components/expectations/ExpectationFormCredenza";
import { ExpectationsRosterTable } from "@/components/expectations/ExpectationsRosterTable";
import { ExpectationsToolbar } from "@/components/expectations/ExpectationsToolbar";
import { PersonalExpectationsPage } from "@/components/expectations/PersonalExpectationsPage";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import PendingComponent from "@/components/loading/PendingComponent";
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
import { useCreateExpectation } from "@/hooks/expectations/useCreateExpectation";
import { useExpectationValues } from "@/hooks/expectations/useExpectationValues";
import { useExpectations } from "@/hooks/expectations/useExpectations";
import { useRemoveExpectation } from "@/hooks/expectations/useRemoveExpectation";
import { useUpdateExpectation } from "@/hooks/expectations/useUpdateExpectation";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useLocalStorageValue } from "@/hooks/useLocalStorageValue";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import {
  filterExpectationsByName,
  isExpectationsViewMode,
  type ExpectationListItem,
} from "@/lib/expectations/expectations";
import { expectationsViewModeStorageKey } from "@/lib/storageKeys";
import type { Id } from "../../../convex/_generated/dataModel";

type ExpectationsPageProps = {
  classId: Id<"classes">;
};

export function ExpectationsPage({ classId }: ExpectationsPageProps) {
  const { can, isPending: permissionsPending } = useCan();

  if (permissionsPending) {
    return <PendingComponent />;
  }

  // Assistant teachers (students:read) get the staff roster UI read-only.
  // Students/guardians get the personal scoped view.
  if (!can("expectations:manage") && !can("students:read")) {
    return <PersonalExpectationsPage classId={classId} />;
  }

  return <StaffExpectationsPage classId={classId} />;
}

function StaffExpectationsPage({ classId }: ExpectationsPageProps) {
  const { t } = useTranslation("expectations");
  const { can } = useCan();
  const canManage = can("expectations:manage");
  const canReadStudents = can("students:read");

  const { data, isPending, isError, refetch } = useExpectations(classId);
  const {
    data: values,
    isPending: valuesPending,
    isError: valuesError,
    refetch: refetchValues,
  } = useExpectationValues(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const {
    data: groupsBoard,
    isPending: boardPending,
    isError: boardError,
    refetch: refetchBoard,
  } = useGroupsBoard(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);

  const createExpectation = useCreateExpectation();
  const updateExpectation = useUpdateExpectation();
  const removeExpectation = useRemoveExpectation();

  useEnsureStudentRosters(
    classId,
    canReadStudents && !rosterPending && !isAuthLoading && !rosterError,
  );

  const [viewMode, setViewMode] = useLocalStorageValue(
    expectationsViewModeStorageKey(classId),
    "grid",
    isExpectationsViewMode,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ExpectationListItem | null>(null);
  const [deleting, setDeleting] = useState<ExpectationListItem | null>(null);

  const filtered = useMemo(
    () => filterExpectationsByName(data ?? [], searchQuery),
    [data, searchQuery],
  );

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
  const { filtered: filteredStudents } = useStudentRosterFilter({
    members: roster,
    query: "",
    membershipByUserId,
    filterState,
  });

  const studentsPending =
    boardPending || (canReadStudents && rosterPending && roster === undefined);
  const tablePending = viewMode === "table" && (studentsPending || valuesPending);
  const pagePending = isPending || tablePending;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <ExpectationsToolbar
        searchQuery={searchQuery}
        resultCount={filtered.length}
        viewMode={viewMode}
        canCreate={canManage}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onCreate={() => setCreateOpen(true)}
      />

      {pagePending ? (
        viewMode === "table" ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        )
      ) : null}

      {isError || valuesError || (viewMode === "table" && (rosterError || boardError)) ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchValues();
            if (canReadStudents) void refetchRoster();
            void refetchBoard();
          }}
        />
      ) : null}

      {!pagePending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {canManage ? t("emptyDescription") : t("emptyDescriptionReader")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!pagePending && !isError && data && data.length > 0 && filtered.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!pagePending && !isError && viewMode === "grid" && filtered.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((expectation) => (
            <li key={expectation._id}>
              <ExpectationCard
                classId={classId}
                expectation={expectation}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!pagePending &&
      !isError &&
      !valuesError &&
      viewMode === "table" &&
      data &&
      data.length > 0 ? (
        <div className="flex flex-col gap-4">
          <GroupTeamFilterButtons classId={classId} />
          {filteredStudents.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target />
                </EmptyMedia>
                <EmptyTitle>{t("studentsEmptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("studentsEmptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ExpectationsRosterTable
              classId={classId}
              students={filteredStudents}
              classStudentCount={roster?.length ?? filteredStudents.length}
              expectations={filtered}
              values={values ?? []}
              canManage={canManage}
            />
          )}
        </div>
      ) : null}

      {canManage ? (
        <>
          <ExpectationFormCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            onSubmit={async (formValues) => {
              await createExpectation.mutateAsync({ classId, ...formValues });
            }}
          />
          <ExpectationFormCredenza
            open={editing != null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            mode="edit"
            initial={editing}
            onSubmit={async (formValues) => {
              if (!editing) return;
              await updateExpectation.mutateAsync({
                classId,
                expectationId: editing._id,
                ...formValues,
              });
              setEditing(null);
            }}
          />
          <DeleteNamedCredenza
            open={deleting != null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            title={t("deleteConfirmTitle", { name: deleting?.name ?? "" })}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              if (!deleting) return;
              await removeExpectation.mutateAsync({
                classId,
                expectationId: deleting._id,
              });
              setDeleting(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
