import { useNavigate } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { AssignmentsToolbar } from "@/components/assignments/AssignmentsToolbar";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
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
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useRemoveAssignment } from "@/hooks/assignments/useRemoveAssignment";
import { useCan } from "@/hooks/permissions/useCan";
import {
  distinctSubjects,
  distinctUnits,
  filterAssignmentsByName,
  filterAssignmentsBySubjectUnit,
  nextAssignmentSortState,
  sortAssignments,
  type AssignmentListItem,
  type AssignmentSortDirection,
  type AssignmentSortKey,
} from "@/lib/assignments/assignments";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignmentsPageProps = {
  classId: Id<"classes">;
};

export function AssignmentsPage({ classId }: AssignmentsPageProps) {
  const { t } = useTranslation("assignments");
  const navigate = useNavigate();
  const { can, isPending: permissionsPending } = useCan();
  const canManage = can("assignments:manage");
  const personalView = !permissionsPending && !can("students:read");
  const { data, isPending, isError, refetch } = useAssignments(classId);
  const removeAssignment = useRemoveAssignment();

  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<AssignmentSortKey>("updated");
  const [sortDirection, setSortDirection] = useState<AssignmentSortDirection>("desc");
  const [deleting, setDeleting] = useState<AssignmentListItem | null>(null);

  const subjects = useMemo(() => distinctSubjects(data ?? []), [data]);
  const units = useMemo(() => distinctUnits(data ?? []), [data]);

  const filteredSorted = useMemo(() => {
    const byFilters = filterAssignmentsBySubjectUnit(data ?? [], subjectFilter, unitFilter);
    const byName = filterAssignmentsByName(byFilters, searchQuery);
    return sortAssignments(byName, sortKey, sortDirection);
  }, [data, searchQuery, sortDirection, sortKey, subjectFilter, unitFilter]);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <AssignmentsToolbar
        sortKey={sortKey}
        sortDirection={sortDirection}
        searchQuery={searchQuery}
        resultCount={filteredSorted.length}
        canCreate={canManage}
        subjects={subjects}
        units={units}
        subjectFilter={subjectFilter}
        unitFilter={unitFilter}
        onSearchChange={setSearchQuery}
        onSortChange={(key) => {
          const next = nextAssignmentSortState(sortKey, sortDirection, key);
          setSortKey(next.sortKey);
          setSortDirection(next.sortDirection);
        }}
        onSubjectFilterChange={setSubjectFilter}
        onUnitFilterChange={setUnitFilter}
        onClearFilters={() => {
          setSubjectFilter(null);
          setUnitFilter(null);
          setSearchQuery("");
        }}
        onCreate={() => {
          void navigate({
            to: "/class/$classId/assignments/new",
            params: { classId },
          });
        }}
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {personalView ? t("emptyDescriptionPersonal") : t("emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button
                type="button"
                onClick={() => {
                  void navigate({
                    to: "/class/$classId/assignments/new",
                    params: { classId },
                  });
                }}
              >
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 && filteredSorted.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && filteredSorted.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((assignment) => (
            <AssignmentCard
              key={assignment._id}
              classId={classId}
              assignment={assignment}
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : null}

      <DeleteNamedCredenza
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteConfirmTitle", { name: deleting?.name ?? "" })}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeAssignment.mutateAsync({
            classId,
            assignmentId: deleting._id,
          });
          setDeleting(null);
        }}
      />
    </div>
  );
}
