import { ListChecks, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignersSeatsTabs } from "@/components/assigners/AssignersSeatsTabs";
import { SeatConstraintCredenza } from "@/components/assigners/SeatConstraintCredenza";
import { SeatConstraintsRosterTable } from "@/components/assigners/SeatConstraintsRosterTable";
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
import { useCreateSeatConstraint } from "@/hooks/assigners/useCreateSeatConstraint";
import { useRemoveSeatConstraint } from "@/hooks/assigners/useRemoveSeatConstraint";
import { useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useUpdateSeatConstraint } from "@/hooks/assigners/useUpdateSeatConstraint";
import { useCan } from "@/hooks/permissions/useCan";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { seatConstraintSummary } from "@/lib/assigners/seatConstraints";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";
import {
  isPairConstraintType,
  type SeatConstraint,
  type SeatConstraintFormValues,
} from "@/lib/assigners/seatConstraints";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignersSeatsConstraintsPageProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsConstraintsPage({ classId }: AssignersSeatsConstraintsPageProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { can } = useCan();
  const canManage = can("assigners:manage");
  // Share `classes.get` cache without the access-log side effect from `useClass`.
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data, isPending, isError, refetch } = useSeatConstraints(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
  } = useStudentRoster(classId);
  const createConstraint = useCreateSeatConstraint();
  const updateConstraint = useUpdateSeatConstraint();
  const removeConstraint = useRemoveSeatConstraint();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SeatConstraint | null>(null);
  const [deleting, setDeleting] = useState<SeatConstraint | null>(null);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");

  const studentNameById = useMemo(() => {
    const map = new Map<Id<"users">, string>();
    for (const student of roster ?? []) {
      map.set(student.userId, getRosterDisplayName(student, unnamed, nameFormat));
    }
    return map;
  }, [nameFormat, roster, unnamed]);

  const studentName = (userId: Id<"users">) =>
    studentNameById.get(userId) ?? t("constraintUnknownStudent");

  const editingInitial: SeatConstraintFormValues | undefined = editing
    ? isPairConstraintType(editing.type)
      ? {
          type: editing.type,
          polarity: editing.polarity,
          studentUserId: editing.studentUserId,
          otherStudentUserId: editing.otherStudentUserId,
        }
      : {
          type: "zone",
          polarity: editing.polarity,
          studentUserId: editing.studentUserId,
          zoneName: editing.zoneName,
        }
    : undefined;

  const loading = isPending || rosterPending;
  const errored = isError || rosterError;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("navSeats")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("constraintsDescription")}</p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createConstraint")}
          </Button>
        ) : null}
      </div>

      <AssignersSeatsTabs classId={classId} value="constraints" />

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : errored ? (
        <ErrorState
          title={t("constraintLoadFailed")}
          description={t("constraintLoadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchRoster();
          }}
        />
      ) : !data?.length ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>{t("constraintsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("constraintsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createConstraint")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <SeatConstraintsRosterTable
          classId={classId}
          constraints={data}
          roster={roster ?? []}
          nameFormat={nameFormat}
          canManage={canManage}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      <SeatConstraintCredenza
        open={createOpen}
        onOpenChange={setCreateOpen}
        classId={classId}
        roster={roster}
        rosterPending={rosterPending}
        nameFormat={nameFormat}
        title={t("createConstraintTitle")}
        description={t("createConstraintDescription")}
        onSubmit={async (values) => {
          await createConstraint.mutateAsync({ classId, ...values });
        }}
      />

      <SeatConstraintCredenza
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        classId={classId}
        roster={roster}
        rosterPending={rosterPending}
        nameFormat={nameFormat}
        title={t("editConstraintTitle")}
        description={t("editConstraintDescription")}
        initial={editingInitial}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateConstraint.mutateAsync({
            classId,
            constraintId: editing._id,
            ...values,
          });
          setEditing(null);
        }}
      />

      <DeleteNamedCredenza
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteConstraintTitle")}
        description={
          deleting
            ? t("deleteConstraintDescription", {
                summary: seatConstraintSummary(deleting, studentName, t),
              })
            : ""
        }
        confirmLabel={t("deleteConstraint")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeConstraint.mutateAsync({
            classId,
            constraintId: deleting._id,
          });
          setDeleting(null);
        }}
      />
    </div>
  );
}
