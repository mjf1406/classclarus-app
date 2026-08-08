import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  ExternalLink,
  ClipboardPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddAssignmentLink } from "@/hooks/assignments/useAddAssignmentLink";
import { useAssignment } from "@/hooks/assignments/useAssignment";
import { useCheckAssignmentLinkAccessibility } from "@/hooks/assignments/useCheckAssignmentLinkAccessibility";
import { useReleasedAssignmentScore } from "@/hooks/assignments/useReleasedAssignmentScore";
import { useRemoveAssignment } from "@/hooks/assignments/useRemoveAssignment";
import { useRemoveAssignmentLink } from "@/hooks/assignments/useRemoveAssignmentLink";
import { useSetAssignmentLinkHandedIn } from "@/hooks/assignments/useSetAssignmentLinkHandedIn";
import { useExpectationValues } from "@/hooks/expectations/useExpectationValues";
import { useExpectationsForAudience } from "@/hooks/expectations/useExpectationsForAudience";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import { formatLocalizedDateTime, formatLocalizedDueDate } from "@/i18n/formatDate";
import { isSelfHosted } from "@/lib/selfHosted";
import {
  isAssignmentPastDue,
  isClassAssignmentDetail,
  isPersonalAssignmentDetail,
  type AssignmentDetailClass,
  type AssignmentDetailPersonal,
  type AssignmentStudentLink,
} from "@/lib/assignments/assignments";
import {
  computeScoreTotals,
  draftFromScore,
  formatScoreFraction,
  formatScorePercent,
  type StudentScoreDraft,
} from "@/lib/assignments/assignmentScores";
import { needsPublicAccessCheck } from "../../../convex/lib/linkAccessibility";
import {
  formatExpectationValue,
  valuesByExpectationAndStudent,
  type ExpectationListItem,
  type ExpectationValue,
} from "@/lib/expectations/expectations";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import { collectAllStudents, sortStudents } from "@/lib/groups/groups";
import { ONE_HOUR } from "@/lib/queryCache";
import {
  getRosterDisplayName,
  normalizeColumnOrder,
  normalizeColumnVisibility,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const ASSIGNMENTS_ROSTER_SURFACE = "assignments";

type AssignmentDetailPageProps = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
};

function FeedbackDescriptionLink({ children }: { children?: ReactNode }) {
  if (isSelfHosted()) {
    return <span>{children}</span>;
  }
  return (
    <Link
      to="/feedback"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </Link>
  );
}

function AssignmentLinksDescription() {
  return (
    <p className="text-sm text-muted-foreground">
      <Trans
        ns="assignments"
        i18nKey="linksDescription"
        components={{ feedbackLink: <FeedbackDescriptionLink /> }}
      />
    </p>
  );
}

export function AssignmentDetailPage({ classId, assignmentId }: AssignmentDetailPageProps) {
  const { can, isPending: permissionsPending } = useCan();
  const isStaff = can("students:read");

  if (permissionsPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isStaff) {
    return <StaffAssignmentDetailPage classId={classId} assignmentId={assignmentId} />;
  }
  return <PersonalAssignmentDetailPage classId={classId} assignmentId={assignmentId} />;
}

function AssignmentDetailBackLink({ classId }: { classId: Id<"classes"> }) {
  const { t } = useTranslation("assignments");
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-fit"
      render={<Link to="/class/$classId/assignments" params={{ classId }} />}
    >
      <ArrowLeft className="size-4" />
      {t("backToList")}
    </Button>
  );
}

function AssignmentMeta({
  assignment,
}: {
  assignment: AssignmentDetailClass | AssignmentDetailPersonal;
}) {
  const { t } = useTranslation("assignments");
  const pastDue = isAssignmentPastDue(assignment.dueDateKey);
  const meta = [assignment.subject, assignment.unit].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{assignment.name}</h1>
      {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
      <p className="text-sm text-muted-foreground">
        {assignment.dueDateKey ? (
          <span className={cn(pastDue && "text-destructive")}>
            {t("dueDateValue", { date: formatLocalizedDueDate(assignment.dueDateKey) })}
            {pastDue ? ` · ${t("statusLate")}` : null}
            {" · "}
          </span>
        ) : null}
        {t("updatedAt", { date: formatLocalizedDateTime(assignment.updatedAt) })}
      </p>
      <p className="text-sm text-muted-foreground">
        {assignment.scoringMode === "total"
          ? t("scoringTotalSummary", { points: assignment.totalPoints ?? 0 })
          : t("scoringSectionSummary", { count: assignment.sections?.length ?? 0 })}
      </p>
    </div>
  );
}

function ReleasedScoreSummary({
  assignment,
  scoreDraft,
  isPending,
}: {
  assignment: AssignmentDetailClass | AssignmentDetailPersonal;
  scoreDraft: StudentScoreDraft | null;
  isPending: boolean;
}) {
  const { t } = useTranslation("assignments");

  if (!assignment.scoresReleased) {
    return null;
  }

  if (isPending) {
    return <Skeleton className="h-24 w-full" />;
  }

  const draft = scoreDraft ?? draftFromScore(undefined);
  const totals = computeScoreTotals(assignment, draft);

  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4">
      <h2 className="text-sm font-medium text-muted-foreground">{t("yourScoreHeading")}</h2>
      {draft.excused ? (
        <p className="mt-1 text-2xl font-semibold tracking-tight">{t("scoreExcused")}</p>
      ) : null}
      {totals.hasScore ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatScoreFraction(totals, t("scoreUnset"))}
          </span>
          <span className="text-lg font-medium text-muted-foreground tabular-nums">
            {formatScorePercent(totals, t("scoreUnset"))}
          </span>
        </p>
      ) : !draft.excused ? (
        <p className="mt-1 text-base text-muted-foreground">{t("noScoreYet")}</p>
      ) : null}
    </section>
  );
}

function AssignmentContentSections({
  classId,
  assignment,
  scoreDraft,
  highlightReleasedScore,
}: {
  classId: Id<"classes">;
  assignment: AssignmentDetailClass | AssignmentDetailPersonal;
  scoreDraft?: StudentScoreDraft | null;
  highlightReleasedScore?: boolean;
}) {
  const { t } = useTranslation("assignments");
  const { t: tTasks } = useTranslation("tasks");
  const isStaffView = assignment.scope === "class";
  const showSelections = highlightReleasedScore === true && scoreDraft != null;

  return (
    <div className="flex flex-col gap-6">
      {assignment.instructionsJson ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("instructionsLabel")}</h2>
          <AnnouncementBody bodyJson={assignment.instructionsJson} />
        </section>
      ) : null}

      {assignment.procedureSteps.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("procedureHeading")}</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            {assignment.procedureSteps.map((step) => {
              const studentCount = step.taskStudentCount ?? 0;
              const completedCount = step.taskCompletedCount ?? 0;
              const showTaskStatus = step.addAsTask && step.taskId !== undefined;
              // Audience-wide: done only when every visible student finished this step's task.
              const allDone = studentCount > 0 && completedCount >= studentCount;
              return (
                <li key={step.key}>
                  <div className="flex flex-wrap items-center gap-2">
                    {showTaskStatus && isStaffView && step.taskId ? (
                      <>
                        <Link
                          to="/class/$classId/tasks/$taskId"
                          params={{ classId, taskId: step.taskId }}
                          className="rounded-sm text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {step.body}
                        </Link>
                        <span className="text-muted-foreground tabular-nums">
                          {tTasks("statsCompleted", {
                            completed: completedCount,
                            total: studentCount,
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{step.body}</span>
                        {showTaskStatus ? (
                          <TaskCompletionStatusBadge
                            completed={allDone}
                            pastDue={isAssignmentPastDue(assignment.dueDateKey)}
                          />
                        ) : step.addAsTask ? (
                          <span className="text-muted-foreground">({t("procedureAddAsTask")})</span>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {assignment.scoringMode === "sections" &&
      assignment.sections &&
      assignment.sections.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("scoringHeading")}</h2>
          <ul className="space-y-3 text-sm">
            {assignment.sections.map((section) => {
              const sectionDraft = scoreDraft?.sectionScores[section.key];
              const earnedPoints = sectionDraft?.pointsEarned;
              const selectedLevelKey = sectionDraft?.selectedLevelKey;
              const checkedKeys = new Set(sectionDraft?.checkedItemKeys ?? []);

              return (
                <li key={section.key} className="rounded-lg border border-border p-3">
                  <p className="font-medium">
                    {section.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      (
                      {section.type === "points"
                        ? t("sectionTypePoints")
                        : section.type === "rubricLevels"
                          ? t("sectionTypeRubricLevels")
                          : t("sectionTypeRubricCheckboxes")}
                      )
                    </span>
                  </p>
                  {section.type === "points" ? (
                    showSelections && earnedPoints !== undefined ? (
                      <p className="mt-1 font-medium tabular-nums text-foreground">
                        {earnedPoints} / {section.maxPoints}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        {t("sectionMaxPointsLabel")}: {section.maxPoints}
                      </p>
                    )
                  ) : null}
                  {section.type === "rubricLevels" ? (
                    <ul className="mt-2 space-y-1">
                      {(section.levels ?? []).map((level) => {
                        const selected = showSelections && selectedLevelKey === level.key;
                        return (
                          <li
                            key={level.key}
                            className={cn(
                              "flex items-start gap-2 rounded-md px-2 py-1.5",
                              selected
                                ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/30"
                                : "text-muted-foreground",
                            )}
                          >
                            {selected ? (
                              <Check
                                className="mt-0.5 size-3.5 shrink-0 text-primary"
                                aria-label={t("scoreSelectedLabel")}
                              />
                            ) : (
                              <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            )}
                            <span>
                              {level.description} ({level.points})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {section.type === "rubricCheckboxes" ? (
                    <ul className="mt-2 space-y-1">
                      {(section.items ?? []).map((item) => {
                        const selected = showSelections && checkedKeys.has(item.key);
                        return (
                          <li
                            key={item.key}
                            className={cn(
                              "flex items-start gap-2 rounded-md px-2 py-1.5",
                              selected
                                ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/30"
                                : "text-muted-foreground",
                            )}
                          >
                            {selected ? (
                              <Check
                                className="mt-0.5 size-3.5 shrink-0 text-primary"
                                aria-label={t("scoreSelectedLabel")}
                              />
                            ) : (
                              <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            )}
                            <span>
                              {item.description} ({item.points})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {assignment.scoringMode === "total" &&
      showSelections &&
      scoreDraft?.totalPointsEarned !== undefined ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("scoringHeading")}</h2>
          <p className="text-sm font-medium tabular-nums">
            {scoreDraft.totalPointsEarned} / {assignment.totalPoints ?? 0}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function LinkList({
  links,
  emphasizeHandedIn,
}: {
  links: AssignmentStudentLink[];
  emphasizeHandedIn?: boolean;
}) {
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => (
        <li key={link._id}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline",
              emphasizeHandedIn && link.handedIn && "font-medium",
              emphasizeHandedIn && !link.handedIn && "text-muted-foreground",
            )}
          >
            {link.label?.trim() || link.url}
            <ExternalLink className="size-3.5" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function StaffAssignmentDetailPage({ classId, assignmentId }: AssignmentDetailPageProps) {
  const { t } = useTranslation("assignments");
  const { t: tExpectations } = useTranslation("expectations");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assignments:manage");
  const canReadStudents = can("students:read");

  const { data, isPending, isError, refetch } = useAssignment(classId, assignmentId);
  const { data: expectationValues } = useExpectationValues(classId);
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
  const { data: settings } = useClassUserSettings(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const removeAssignment = useRemoveAssignment();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEnsureStudentRosters(
    classId,
    canReadStudents && !rosterPending && !isAuthLoading && !rosterError,
  );

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const columnOrder = useMemo(
    () => normalizeColumnOrder(settings?.studentsColumnOrder),
    [settings?.studentsColumnOrder],
  );
  const baseColumnVisibility = useMemo(
    () => normalizeColumnVisibility(settings?.studentsColumnVisibility),
    [settings?.studentsColumnVisibility],
  );
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    ASSIGNMENTS_ROSTER_SURFACE,
    baseColumnVisibility,
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

  const linksByStudent = useMemo(() => {
    const map = new Map<Id<"users">, AssignmentStudentLink[]>();
    if (!assignment) return map;
    for (const link of assignment.links) {
      const existing = map.get(link.studentUserId) ?? [];
      existing.push(link);
      map.set(link.studentUserId, existing);
    }
    return map;
  }, [assignment]);

  const expectationValueMap = useMemo(
    () => valuesByExpectationAndStudent(expectationValues),
    [expectationValues],
  );

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    const expectationColumns: ColumnDef<StudentRosterEntry, unknown>[] = (
      assignment?.expectations ?? []
    ).map((expectation) => ({
      id: `expectation:${expectation._id}`,
      accessorFn: (row) => {
        const value = expectationValueMap.get(`${expectation._id}:${row.userId}`);
        if (expectation.inputType === "number") return value?.numberValue ?? null;
        return value?.rangeMin ?? null;
      },
      header: ({ column }) => (
        <DataTableSortableHeader
          label={`${expectation.name} (${expectation.unit})`}
          sorted={column.getIsSorted()}
          onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const value = expectationValueMap.get(`${expectation._id}:${row.original.userId}`);
        return (
          <span className="tabular-nums">
            {formatExpectationValue(expectation, value, tExpectations("rosterUnset"))}
          </span>
        );
      },
      enableSorting: true,
    }));

    const linkColumns: ColumnDef<StudentRosterEntry, unknown>[] =
      assignment?.acceptLinkSubmissions === false
        ? []
        : [
            {
              id: "handedInLinks",
              accessorFn: (row) =>
                (linksByStudent.get(row.userId) ?? []).filter((link) => link.handedIn).length,
              header: ({ column }) => (
                <DataTableSortableHeader
                  label={t("columnHandedInLinks")}
                  sorted={column.getIsSorted()}
                  onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
                />
              ),
              cell: ({ row }) => {
                const links = (linksByStudent.get(row.original.userId) ?? []).filter(
                  (link) => link.handedIn,
                );
                if (links.length === 0) {
                  return <span className="text-muted-foreground">—</span>;
                }
                return <LinkList links={links} />;
              },
              enableSorting: true,
            },
            {
              id: "otherLinks",
              accessorFn: (row) =>
                (linksByStudent.get(row.userId) ?? []).filter((link) => !link.handedIn).length,
              header: ({ column }) => (
                <DataTableSortableHeader
                  label={t("columnOtherLinks")}
                  sorted={column.getIsSorted()}
                  onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
                />
              ),
              cell: ({ row }) => {
                const links = (linksByStudent.get(row.original.userId) ?? []).filter(
                  (link) => !link.handedIn,
                );
                if (links.length === 0) {
                  return <span className="text-muted-foreground">—</span>;
                }
                return <LinkList links={links} />;
              },
              enableSorting: true,
            },
          ];

    return [...linkColumns, ...expectationColumns];
  }, [
    assignment?.acceptLinkSubmissions,
    assignment?.expectations,
    expectationValueMap,
    linksByStudent,
    t,
    tExpectations,
  ]);

  const studentsPending =
    boardPending || (canReadStudents && rosterPending && roster === undefined);

  if (isPending || studentsPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || boardError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetch();
            void refetchBoard();
            if (canReadStudents) void refetchRoster();
          }}
        />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <AssignmentDetailBackLink classId={classId} />
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <AssignmentDetailBackLink classId={classId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AssignmentMeta assignment={assignment} />
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              render={
                <Link
                  to="/class/$classId/assignments/$assignmentId/grade"
                  params={{ classId, assignmentId }}
                />
              }
            >
              <ClipboardPen className="size-4" />
              {t("gradeAction")}
            </Button>
            <Button
              type="button"
              variant="outline"
              render={
                <Link
                  to="/class/$classId/assignments/$assignmentId/edit"
                  params={{ classId, assignmentId }}
                />
              }
            >
              <Pencil className="size-4" />
              {t("editAction")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              {t("deleteAction")}
            </Button>
          </div>
        ) : null}
      </div>

      <AssignmentContentSections classId={classId} assignment={assignment} />

      {assignment.expectations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("expectationsHeading")}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {assignment.expectations.map((expectation) => (
              <li key={expectation._id}>
                {expectation.name} ({expectation.unit})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {assignment.acceptLinkSubmissions ? t("linksHeading") : t("studentsHeading")}
        </h2>
        <GroupTeamFilterButtons classId={classId} />
        {filtered.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>{t("studentsEmptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("studentsEmptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex justify-end">
              <RosterColumnVisibilityMenu
                columnOrder={columnOrder}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
              />
            </div>
            <RosterTable
              data={filtered}
              columnOrder={columnOrder}
              columnVisibility={columnVisibility}
              extraColumns={extraColumns}
            />
          </div>
        )}
      </section>

      <DeleteNamedCredenza
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteConfirmTitle", { name: assignment.name })}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          await removeAssignment.mutateAsync({ classId, assignmentId });
          setDeleteOpen(false);
          await navigate({ to: "/class/$classId/assignments", params: { classId } });
        }}
      />
    </div>
  );
}

function personalExpectationValue(
  expectationId: Id<"expectations">,
  studentUserId: Id<"users">,
  valueMap: Map<string, ExpectationValue>,
  embedded:
    | {
        numberValue?: number;
        rangeMin?: number;
        rangeMax?: number;
      }
    | undefined,
): ExpectationValue | undefined {
  const fromAudience = valueMap.get(`${expectationId}:${studentUserId}`);
  if (fromAudience) return fromAudience;
  if (!embedded) return undefined;
  if (
    embedded.numberValue === undefined &&
    embedded.rangeMin === undefined &&
    embedded.rangeMax === undefined
  ) {
    return undefined;
  }
  // Minimal shape for formatExpectationValue (only number/range fields are read).
  return embedded as ExpectationValue;
}

function PersonalAssignmentDetailPage({ classId, assignmentId }: AssignmentDetailPageProps) {
  const { t } = useTranslation("assignments");
  const { t: tExpectations } = useTranslation("expectations");
  const { t: tClasses } = useTranslation("classes");
  const { data: currentUser } = useCurrentUser();
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const { data, isPending, isError, refetch } = useAssignment(classId, assignmentId);
  const { data: audienceData } = useExpectationsForAudience(classId);
  const addLink = useAddAssignmentLink();
  const removeLink = useRemoveAssignmentLink();
  const setHandedIn = useSetAssignmentLinkHandedIn();
  const { check: checkLinkAccess } = useCheckAssignmentLinkAccessibility();

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checkingLinkAccess, setCheckingLinkAccess] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<Id<"assignmentStudentLinks"> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  const assignment = data && isPersonalAssignmentDetail(data) ? data : null;
  const students = useMemo(() => assignment?.students ?? [], [assignment?.students]);
  const scoresReleased = assignment?.scoresReleased === true;

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const valueMap = useMemo(
    () => valuesByExpectationAndStudent(audienceData?.values),
    [audienceData?.values],
  );

  const expectationsById = useMemo(() => {
    const map = new Map<Id<"expectations">, ExpectationListItem>();
    for (const expectation of audienceData?.expectations ?? []) {
      map.set(expectation._id, expectation);
    }
    return map;
  }, [audienceData?.expectations]);

  useEffect(() => {
    if (students.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (selectedUserId && students.some((student) => student.userId === selectedUserId)) {
      return;
    }
    const selfId = currentUser?._id;
    const preferred =
      (selfId && students.find((student) => student.userId === selfId)?.userId) ||
      students[0]!.userId;
    setSelectedUserId(preferred);
  }, [currentUser?._id, selectedUserId, students]);

  const activeStudent =
    students.find((student) => student.userId === selectedUserId) ?? students[0];

  const { data: releasedScore, isPending: releasedScorePending } = useReleasedAssignmentScore(
    classId,
    assignmentId,
    activeStudent?.userId ?? selectedUserId,
    scoresReleased && Boolean(activeStudent?.userId ?? selectedUserId),
  );

  const scoreDraft = useMemo(
    () => (scoresReleased ? draftFromScore(releasedScore ?? undefined) : null),
    [releasedScore, scoresReleased],
  );

  const linkedExpectations = useMemo(() => {
    if (!assignment) return [] as ExpectationListItem[];
    const fromAudience = assignment.expectationIds
      .map((expectationId) => expectationsById.get(expectationId))
      .filter((expectation): expectation is ExpectationListItem => expectation !== undefined);
    if (fromAudience.length > 0) return fromAudience;

    // Fallback while audience query loads / if catalog is filtered: use embedded rows.
    return (activeStudent?.expectations ?? []).map((expectation) => ({
      _id: expectation._id,
      _creationTime: 0,
      classId,
      name: expectation.name,
      unit: expectation.unit,
      inputType: expectation.inputType,
      createdBy: "" as Id<"users">,
      createdAt: 0,
      updatedAt: 0,
      valueCount: 0,
    }));
  }, [activeStudent?.expectations, assignment, classId, expectationsById]);

  const activeName = activeStudent
    ? getRosterDisplayName(activeStudent, tClasses("unnamedMember"), nameFormat)
    : null;

  if (isPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <AssignmentDetailBackLink classId={classId} />
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <AssignmentDetailBackLink classId={classId} />
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>{t("notFoundTitle")}</EmptyTitle>
            <EmptyDescription>{t("notFoundDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!activeStudent) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <AssignmentDetailBackLink classId={classId} />
        <AssignmentMeta assignment={assignment} />
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <AssignmentDetailBackLink classId={classId} />
      <AssignmentMeta assignment={assignment} />

      {selectedUserId ? (
        <PersonalStudentPicker
          students={students}
          selectedUserId={selectedUserId}
          nameFormat={nameFormat}
          onSelect={setSelectedUserId}
        />
      ) : null}

      {activeName && students.length > 1 ? (
        <p className="text-sm text-muted-foreground">
          {tExpectations("personalStudentLabel", { name: activeName })}
        </p>
      ) : null}

      {scoresReleased ? (
        <ReleasedScoreSummary
          assignment={assignment}
          scoreDraft={scoreDraft}
          isPending={releasedScorePending}
        />
      ) : null}

      <AssignmentContentSections
        classId={classId}
        assignment={assignment}
        scoreDraft={scoreDraft}
        highlightReleasedScore={scoresReleased && !releasedScorePending}
      />

      {assignment.expectationIds.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("expectationsHeading")}</h2>
          {linkedExpectations.length === 0 ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <ul className="space-y-2 text-sm">
              {linkedExpectations.map((expectation) => {
                const embedded = activeStudent.expectations.find(
                  (row) => row._id === expectation._id,
                );
                const value = personalExpectationValue(
                  expectation._id,
                  activeStudent.userId,
                  valueMap,
                  embedded,
                );
                return (
                  <li
                    key={expectation._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{expectation.name}</span>
                      <span className="text-muted-foreground"> ({expectation.unit})</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {formatExpectationValue(expectation, value, tExpectations("rosterUnset"))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {assignment.acceptLinkSubmissions ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("linksHeading")}</h2>
            <AssignmentLinksDescription />
          </div>

          {activeStudent.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeStudent.links.map((link) => (
                <li
                  key={link._id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {link.label?.trim() || link.url}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <div className="flex items-center gap-3">
                    {activeStudent.canEditLinks ? (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={link.handedIn}
                            onCheckedChange={(checked) => {
                              void setHandedIn.mutateAsync({
                                classId,
                                assignmentId,
                                linkId: link._id,
                                handedIn: checked === true,
                                studentUserId: activeStudent.userId,
                              });
                            }}
                          />
                          {t("linksHandIn")}
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("deleteAction")}
                          onClick={() => setDeletingLinkId(link._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {link.handedIn ? t("linksHandedIn") : t("linksNotHandedIn")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {activeStudent.canEditLinks ? (
            <form
              className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (checkingLinkAccess || addLink.isPending) return;
                setLinkError(null);
                const trimmedUrl = url.trim();
                if (!trimmedUrl) {
                  setLinkError(t("linksUrlRequired"));
                  return;
                }
                try {
                  const parsed = new URL(trimmedUrl);
                  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                    setLinkError(t("linksUrlInvalid"));
                    return;
                  }
                } catch {
                  setLinkError(t("linksUrlInvalid"));
                  return;
                }

                void (async () => {
                  if (needsPublicAccessCheck(trimmedUrl)) {
                    setCheckingLinkAccess(true);
                    try {
                      const result = await checkLinkAccess(trimmedUrl);
                      if (result.access === "private") {
                        setLinkError(
                          result.provider === "canva"
                            ? t("linksAccessPrivateCanva")
                            : t("linksAccessPrivateGoogle"),
                        );
                        return;
                      }
                      if (result.access === "unknown") {
                        setLinkError(t("linksAccessUnverified"));
                        return;
                      }
                    } catch (error: unknown) {
                      setLinkError(
                        error instanceof Error ? error.message : t("linksAccessCheckFailed"),
                      );
                      return;
                    } finally {
                      setCheckingLinkAccess(false);
                    }
                  }

                  try {
                    await addLink.mutateAsync({
                      classId,
                      assignmentId,
                      url: trimmedUrl,
                      label: label.trim() || undefined,
                      studentUserId: activeStudent.userId,
                    });
                    setUrl("");
                    setLabel("");
                  } catch (error: unknown) {
                    setLinkError(error instanceof Error ? error.message : t("linkSaveFailed"));
                  }
                })();
              }}
            >
              <Field>
                <FieldLabel htmlFor="assignment-link-url">{t("linksUrlLabel")}</FieldLabel>
                <Input
                  id="assignment-link-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                  disabled={checkingLinkAccess || addLink.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="assignment-link-label">{t("linksLabelLabel")}</FieldLabel>
                <Input
                  id="assignment-link-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={t("linksLabelOptional")}
                  disabled={checkingLinkAccess || addLink.isPending}
                />
              </Field>
              {linkError ? <FieldError>{linkError}</FieldError> : null}
              <Button
                type="submit"
                className="w-fit"
                disabled={checkingLinkAccess || addLink.isPending}
              >
                <Plus className="size-4" />
                {checkingLinkAccess ? t("linksAccessChecking") : t("linksAdd")}
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      <DeleteNamedCredenza
        open={deletingLinkId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLinkId(null);
        }}
        title={t("linkDeleteConfirmTitle")}
        description={t("linkDeleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          if (!deletingLinkId) return;
          await removeLink.mutateAsync({
            classId,
            assignmentId,
            linkId: deletingLinkId,
          });
          setDeletingLinkId(null);
        }}
      />
    </div>
  );
}
