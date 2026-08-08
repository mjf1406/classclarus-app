import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Unlock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AssignmentGradeRosterTable } from "@/components/assignments/AssignmentGradeRosterTable";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignment } from "@/hooks/assignments/useAssignment";
import { useAssignmentScores } from "@/hooks/assignments/useAssignmentScores";
import { useSetAssignmentScoresReleased } from "@/hooks/assignments/useSetAssignmentScoresReleased";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { isClassAssignmentDetail } from "@/lib/assignments/assignments";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import { collectAllStudents, sortStudents } from "@/lib/groups/groups";
import { ONE_HOUR } from "@/lib/queryCache";
import { resolveRosterNameFormat, type StudentRosterEntry } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignmentGradePageProps = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
};

export function AssignmentGradePage({ classId, assignmentId }: AssignmentGradePageProps) {
  const { t } = useTranslation("assignments");
  const { data, isPending, isError, refetch } = useAssignment(classId, assignmentId);
  const {
    data: scores,
    isPending: scoresPending,
    isError: scoresError,
    refetch: refetchScores,
  } = useAssignmentScores(classId, assignmentId);
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const {
    data: groupsBoard,
    isPending: boardPending,
    isError: boardError,
    refetch: refetchBoard,
  } = useGroupsBoard(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const setReleased = useSetAssignmentScoresReleased();

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const students = useMemo((): StudentRosterEntry[] => {
    if (roster !== undefined) {
      return roster;
    }
    if (!groupsBoard) return [];
    return sortStudents(collectAllStudents(groupsBoard), nameFormat).map((student, index) => ({
      userId: student.userId,
      rosterNumber: index + 1,
      firstName: student.firstName,
      lastName: student.lastName,
      name: student.name,
      email: student.email,
      role: "student" as const,
    }));
  }, [groupsBoard, nameFormat, roster]);

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
    members: students,
    query: "",
    membershipByUserId,
    filterState,
  });

  const assignment = data && isClassAssignmentDetail(data) ? data : null;
  const loading = isPending || scoresPending || boardPending || rosterPending || isAuthLoading;

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || scoresError || boardError || rosterError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchScores();
            void refetchBoard();
            void refetchRoster();
          }}
        />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={
            <Link
              to="/class/$classId/assignments/$assignmentId"
              params={{ classId, assignmentId }}
            />
          }
        >
          <ArrowLeft className="size-4" />
          {t("backToAssignment")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  const released = assignment.scoresReleased === true;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        render={
          <Link to="/class/$classId/assignments/$assignmentId" params={{ classId, assignmentId }} />
        }
      >
        <ArrowLeft className="size-4" />
        {t("backToAssignment")}
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight" title={assignment.name}>
            {assignment.name}
          </h1>
          <p className="text-muted-foreground text-sm">{t("gradeTitle")}</p>
          <p className="text-muted-foreground text-sm">
            {released ? t("scoresReleasedStatus") : t("scoresNotReleasedStatus")}
          </p>
        </div>
        <Button
          type="button"
          variant={released ? "outline" : "default"}
          onClick={() => {
            void setReleased.mutateAsync({
              classId,
              assignmentId,
              released: !released,
            });
          }}
        >
          {released ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          {released ? t("unreleaseScoresAction") : t("releaseScoresAction")}
        </Button>
      </div>

      <GroupTeamFilterButtons classId={classId} />

      {filtered.length === 0 ? (
        <ErrorState title={t("studentsEmptyTitle")} description={t("studentsEmptyDescription")} />
      ) : (
        <AssignmentGradeRosterTable
          classId={classId}
          assignmentId={assignmentId}
          assignment={assignment}
          students={filtered}
          scores={scores ?? []}
        />
      )}
    </div>
  );
}
