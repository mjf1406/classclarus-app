import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ExpectationFormCredenza } from "@/components/expectations/ExpectationFormCredenza";
import { ExpectationsRosterTable } from "@/components/expectations/ExpectationsRosterTable";
import { PersonalExpectationDetailPage } from "@/components/expectations/PersonalExpectationDetailPage";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import PendingComponent from "@/components/loading/PendingComponent";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpectation } from "@/hooks/expectations/useExpectation";
import { useExpectationValuesForExpectation } from "@/hooks/expectations/useExpectationValuesForExpectation";
import { useRemoveExpectation } from "@/hooks/expectations/useRemoveExpectation";
import { useUpdateExpectation } from "@/hooks/expectations/useUpdateExpectation";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import type { Id } from "../../../convex/_generated/dataModel";

type ExpectationDetailPageProps = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
};

export function ExpectationDetailPage({ classId, expectationId }: ExpectationDetailPageProps) {
  const { can, isPending: permissionsPending } = useCan();

  if (permissionsPending) {
    return <PendingComponent />;
  }

  if (!can("expectations:manage") && !can("students:read")) {
    return <PersonalExpectationDetailPage classId={classId} expectationId={expectationId} />;
  }

  return <StaffExpectationDetailPage classId={classId} expectationId={expectationId} />;
}

function StaffExpectationDetailPage({ classId, expectationId }: ExpectationDetailPageProps) {
  const { t } = useTranslation("expectations");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("expectations:manage");
  const canReadStudents = can("students:read");

  const { data, isPending, isError, refetch } = useExpectation(classId, expectationId);
  const {
    data: values,
    isPending: valuesPending,
    isError: valuesError,
    refetch: refetchValues,
  } = useExpectationValuesForExpectation(classId, expectationId);
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
  const updateExpectation = useUpdateExpectation();
  const removeExpectation = useRemoveExpectation();

  useEnsureStudentRosters(
    classId,
    canReadStudents && !rosterPending && !isAuthLoading && !rosterError,
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    members: roster,
    query: "",
    membershipByUserId,
    filterState,
  });

  const studentsPending =
    boardPending || (canReadStudents && rosterPending && roster === undefined);

  if (isPending || studentsPending || valuesPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || valuesError || rosterError || boardError) {
    return (
      <div className="px-4 py-8 sm:px-8">
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
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={<Link to="/class/$classId/expectations" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  const inputTypeLabel =
    data.inputType === "numberRange" ? t("inputTypeNumberRange") : t("inputTypeNumber");

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={<Link to="/class/$classId/expectations" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{data.name}</h1>
            <p className="text-muted-foreground">
              {data.description?.trim() || t("emptyDescriptionPreview")}
            </p>
            <p className="text-sm text-muted-foreground">
              {inputTypeLabel} · {data.unit} · {t("valueCount", { count: data.valueCount })}
            </p>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                {t("editAction")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                {t("deleteAction")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <GroupTeamFilterButtons classId={classId} />

      {filtered.length === 0 ? (
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
          students={filtered}
          classStudentCount={roster?.length ?? filtered.length}
          expectations={[data]}
          values={values ?? []}
          singleExpectationMode
          canManage={canManage}
        />
      )}

      {canManage ? (
        <>
          <ExpectationFormCredenza
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            initial={data}
            onSubmit={async (formValues) => {
              await updateExpectation.mutateAsync({
                classId,
                expectationId,
                ...formValues,
              });
            }}
          />
          <DeleteNamedCredenza
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("deleteConfirmTitle", { name: data.name })}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              await removeExpectation.mutateAsync({ classId, expectationId });
              void navigate({ to: "/class/$classId/expectations", params: { classId } });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
