import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PointsLedgerTable } from "@/components/points/PointsLedgerTable";
import { StudentPointsSummaryCard } from "@/components/points/StudentPointsSummaryCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useCan } from "@/hooks/permissions/useCan";
import { useDeletePointsLedgerEntry } from "@/hooks/points/useDeletePointsLedgerEntry";
import { usePointsBoard } from "@/hooks/points/usePointsBoard";
import type { PointsLedgerItem } from "@/hooks/points/usePointsLedgerForAudience";
import { usePointsLedgerForStudent } from "@/hooks/points/usePointsLedgerForStudent";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import { isTeacherPlusRole } from "@/lib/permissions/classPermissions";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

type StudentPointsHistoryPageProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
};

type PendingDelete = Extract<PointsLedgerItem, { kind: "behavior" | "reward" }>;

function pendingDeleteLabel(item: PendingDelete, fallback: string): string {
  return item.name?.trim() ? item.name : fallback;
}

export function StudentPointsHistoryPage({
  classId,
  studentUserId,
}: StudentPointsHistoryPageProps) {
  const { t } = useTranslation("points");
  const { t: tClasses } = useTranslation("classes");
  const { role } = useCan();
  const canDelete = isTeacherPlusRole(role);
  const dateKey = useMemo(() => localDateKey(), []);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const { data, isPending, isError, refetch } = usePointsBoard(classId, dateKey);
  const ledger = usePointsLedgerForStudent(classId, studentUserId);
  const deleteEntry = useDeletePointsLedgerEntry();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const student = data?.find((entry) => entry.userId === studentUserId);
  const displayName = student
    ? getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat)
    : tClasses("unnamedMember");

  const accessArgs = useMemo(
    () =>
      student
        ? {
            classId,
            resourceType: "points",
            resourceId: studentUserId,
            summary: "Viewed student points history",
            summaryKey: "activitySummary_viewedStudentPointsHistory",
            metadata: { studentUserId },
          }
        : null,
    [classId, student, studentUserId],
  );
  useLogClassAccessOnce(Boolean(student) && !isPending, accessArgs);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={<Link to="/class/$classId/points" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToPoints")}
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("historyTitle")}</h1>
          <p className="hidden text-muted-foreground sm:block">
            {t("historyDescription", { name: displayName })}
          </p>
        </div>
      </div>

      {isPending ? <Skeleton className="h-36 w-full max-w-md rounded-2xl" /> : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && !student ? (
        <ErrorState
          title={t("historyNotFoundTitle")}
          description={t("historyNotFoundDescription")}
        />
      ) : null}

      {!isPending && !isError && student ? (
        <>
          <div className="max-w-md">
            <StudentPointsSummaryCard student={student} nameFormat={nameFormat} />
          </div>
          <PointsLedgerTable
            items={ledger.items}
            isPending={ledger.isPending}
            isRefreshing={ledger.isRefreshing}
            isError={ledger.isError}
            onRetry={() => void ledger.refetch()}
            hasNextPage={Boolean(ledger.hasNextPage)}
            isFetchingNextPage={ledger.isFetchingNextPage}
            onLoadMore={async () => {
              await ledger.fetchNextPage();
            }}
            resetKey={studentUserId}
            canDelete={canDelete}
            onDelete={canDelete ? (item) => setPendingDelete(item) : undefined}
          />
        </>
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ledgerDeleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ledgerDeleteConfirmDescription", {
                description: pendingDelete
                  ? pendingDeleteLabel(pendingDelete, t("ledgerDeletedItem"))
                  : t("ledgerDeletedItem"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                const item = pendingDelete;
                setPendingDelete(null);
                void deleteEntry.mutateAsync({
                  classId,
                  dateKey,
                  studentUserId,
                  item,
                });
              }}
            >
              {t("ledgerDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
