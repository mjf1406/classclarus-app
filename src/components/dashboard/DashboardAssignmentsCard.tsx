import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AssignmentGradingStatusBadge } from "@/components/assignments/AssignmentGradingStatusBadge";
import { AssignmentHandInStatusBadge } from "@/components/assignments/AssignmentHandInStatusBadge";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { formatLocalizedDueDate } from "@/i18n/formatDate";
import {
  computeScoreTotals,
  draftFromScore,
  formatScoreFraction,
  formatScorePercent,
} from "@/lib/assignments/assignmentScores";
import {
  assignmentGradingStatusForStudent,
  isAssignmentPastDue,
  isStudentAssignmentHandedIn,
  type AssignmentListItem,
} from "@/lib/assignments/assignments";
import { dashboardAssignmentCounts, upcomingDashboardAssignments } from "@/lib/dashboard/dashboard";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardAssignmentsCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
  audiencePending: boolean;
};

function ReleasedScoreLine({
  assignment,
  studentUserId,
}: {
  assignment: AssignmentListItem;
  studentUserId: string;
}) {
  const { t } = useTranslation("assignments");
  const score = (assignment.viewerReleasedScores ?? []).find(
    (row) => row.studentUserId === studentUserId,
  );

  if (!score) {
    return <span className="text-xs font-medium">{t("noScoreYet")}</span>;
  }
  if (score.excused) {
    return <span className="text-xs font-medium">{t("scoreExcused")}</span>;
  }

  const totals = computeScoreTotals(assignment, draftFromScore(score));
  if (!totals.hasScore) {
    return <span className="text-xs font-medium">{t("noScoreYet")}</span>;
  }

  return (
    <span className="text-xs font-medium tabular-nums">
      {t("scoreCardSummary", {
        score: formatScoreFraction(totals, t("scoreUnset")),
        grade: formatScorePercent(totals, t("scoreUnset")),
      })}
    </span>
  );
}

export function DashboardAssignmentsCard({
  classId,
  studentUserId,
  audiencePending,
}: DashboardAssignmentsCardProps) {
  const { t } = useTranslation("classes");
  const { t: tAssignments } = useTranslation("assignments");
  const query = useAssignments(classId);
  const now = useMemo(() => new Date(), []);
  const assignments = useMemo(
    () => upcomingDashboardAssignments(query.data ?? [], now),
    [now, query.data],
  );
  const counts = useMemo(() => {
    if (!studentUserId) return { dueThisWeek: 0, notHandedIn: 0 };
    return dashboardAssignmentCounts(query.data ?? [], studentUserId, now);
  }, [now, query.data, studentUserId]);
  const isPending = audiencePending || query.isPending;
  const empty = !isPending && !query.isError && assignments.length === 0;

  const summaryParts: string[] = [];
  if (counts.dueThisWeek > 0) {
    summaryParts.push(t("dashboardAssignmentsDueSoon", { count: counts.dueThisWeek }));
  }
  if (counts.notHandedIn > 0) {
    summaryParts.push(t("dashboardAssignmentsNotHandedIn", { count: counts.notHandedIn }));
  }

  return (
    <DashboardSectionCard
      title={t("dashboardAssignmentsTitle")}
      viewAllLabel={t("dashboardViewAll")}
      viewAllTo="/class/$classId/assignments"
      viewAllParams={{ classId }}
      isPending={isPending}
      isError={query.isError}
      errorTitle={t("dashboardLoadFailed")}
      errorDescription={t("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={t("dashboardNoAssignmentsTitle")}
      emptyDescription={t("dashboardNoAssignmentsDescription")}
    >
      {summaryParts.length > 0 ? (
        <p className="text-xs text-muted-foreground">{summaryParts.join(" · ")}</p>
      ) : null}
      {assignments.map((assignment) => {
        const pastDue = isAssignmentPastDue(assignment.dueDateKey);
        const meta = [assignment.subject, assignment.unit].filter(Boolean).join(" · ");
        const handedIn =
          studentUserId !== null && isStudentAssignmentHandedIn(assignment, studentUserId);
        const showScore = studentUserId !== null && assignment.scoresReleased === true;

        return (
          <Link
            key={assignment._id}
            to="/class/$classId/assignments/$assignmentId"
            params={{ classId, assignmentId: assignment._id }}
            className="flex flex-col gap-2 rounded-xl border px-3 py-2 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{assignment.name}</span>
              {studentUserId !== null ? (
                <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                  <AssignmentGradingStatusBadge
                    status={assignmentGradingStatusForStudent(assignment, studentUserId)}
                  />
                  {assignment.acceptLinkSubmissions ? (
                    <AssignmentHandInStatusBadge handedIn={handedIn} pastDue={pastDue} />
                  ) : null}
                </span>
              ) : null}
            </div>
            {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
            {assignment.dueDateKey ? (
              <span className={cn("text-xs text-muted-foreground", pastDue && "text-destructive")}>
                {tAssignments("dueDateValue", {
                  date: formatLocalizedDueDate(assignment.dueDateKey),
                })}
              </span>
            ) : null}
            {showScore && studentUserId !== null ? (
              <ReleasedScoreLine assignment={assignment} studentUserId={studentUserId} />
            ) : null}
          </Link>
        );
      })}
    </DashboardSectionCard>
  );
}
