import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
import { AssignmentGradingStatusBadge } from "@/components/assignments/AssignmentGradingStatusBadge";
import { AssignmentHandInStatusBadge } from "@/components/assignments/AssignmentHandInStatusBadge";
import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { TaskCompletionStatusBadge } from "@/components/tasks/TaskCompletionStatusBadge";
import { TimetableAgendaItemView } from "@/components/timetable/TimetableAgendaItemView";
import { TimetableTaggedText } from "@/components/timetable/TimetableTaggedText";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import {
  classroomMinuteBucket,
  useClassroomDisplayBundle,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useTasks } from "@/hooks/tasks/useTasks";
import {
  assignmentGradingStatusForStudent,
  isAssignmentPastDue,
  isStudentAssignmentHandedIn,
  type AssignmentListItem,
} from "@/lib/assignments/assignments";
import {
  formatLessonDisplayStatusLabel,
  lessonSlotTimes,
  resolveLessonDisplayState,
  resolveLessonDisplayStatus,
} from "@/lib/classroomScreen/lessonDisplayState";
import { formatLocalizedTimeRange } from "@/i18n/formatDate";
import { toIntlLocale } from "@/lib/languages";
import { findAgendaResourceName } from "@/lib/timetable/agendaItems";
import { slotDurationMinutes } from "@/lib/timetable/utils";
import { areAllStudentsCompleteOnTask, isTaskPastDue, type TaskListItem } from "@/lib/tasks/tasks";
import type { Id } from "../../../convex/_generated/dataModel";
import { isValidHttpUrl } from "../../../convex/lib/timetable/timetableSchema";

type DashboardCurrentSubjectCardProps = {
  classId: Id<"classes">;
  studentUserId: Id<"users"> | null;
};

type SubjectTab = "agenda" | "materials" | "resources";

export function DashboardCurrentSubjectCard({
  classId,
  studentUserId,
}: DashboardCurrentSubjectCardProps) {
  const { t: tClasses } = useTranslation("classes");
  const { t: tClassroomScreen } = useTranslation("classroomScreen");
  const { t: tTimetable, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const [minuteBucket, setMinuteBucket] = useState(() => classroomMinuteBucket());
  const query = useClassroomDisplayBundle(classId, minuteBucket);
  const assignmentsQuery = useAssignments(classId);
  const tasksQuery = useTasks(classId);
  const bundle = query.data;
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<SubjectTab>("agenda");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
      setMinuteBucket(classroomMinuteBucket());
    }, 5_000);
    return () => window.clearInterval(interval);
  }, []);

  const lessonState = useMemo(() => resolveLessonDisplayState(bundle, now), [bundle, now]);
  const statusLabel = useMemo(() => {
    if (!bundle) return null;
    const status = resolveLessonDisplayStatus(lessonState, bundle.displaySession.pushedUntil, now);
    if (status.kind === "current") return null;
    return formatLessonDisplayStatusLabel(status, tClassroomScreen, now);
  }, [bundle, lessonState, now, tClassroomScreen]);

  const lesson = lessonState.showLessonContent ? lessonState.activeLesson : null;
  const slotTimes = lesson ? lessonSlotTimes(lesson, bundle?.currentSlot) : null;
  const timeFormat = bundle?.settings.timeFormat === "12h" ? "12" : "24";
  const quickText = lessonState.globalQuickText?.trim() || null;
  const quickTextTitle =
    bundle?.settings.quickTextTitle?.trim() || tClassroomScreen("statusQuickText");
  const hasPreviewContent = Boolean(lesson) || Boolean(quickText);
  const empty = !query.isPending && !query.isError && !hasPreviewContent;

  return (
    <DashboardSectionCard
      title={tClasses("dashboardCurrentSubjectTitle")}
      viewAllLabel={tClasses("dashboardOpenClassroomScreen")}
      viewAllTo="/class/$classId/classroom-screen"
      viewAllParams={{ classId }}
      viewAllOpenInNewTab
      isPending={query.isPending}
      isError={query.isError}
      errorTitle={tClasses("dashboardLoadFailed")}
      errorDescription={tClasses("dashboardLoadFailedDescription")}
      onRetry={() => void query.refetch()}
      empty={empty}
      emptyTitle={tClassroomScreen("noLessonScheduledTitle")}
      emptyDescription={tClassroomScreen("noLessonScheduledDescription")}
      pendingFallback={<Skeleton className="h-40 w-full rounded-xl" />}
    >
      <div className="flex flex-col gap-3">
        {statusLabel ? <p className="text-xs text-muted-foreground">{statusLabel}</p> : null}
        {lesson ? (
          <>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                backgroundColor: lesson.subjectBgColor,
                color: lesson.subjectTextColor,
              }}
            >
              {lesson.subjectIconName ? (
                <span
                  className="inline-flex shrink-0 items-center justify-center"
                  style={{ width: 32, height: 32, fontSize: 32 }}
                >
                  <FontAwesomeIconFromId id={lesson.subjectIconName} />
                </span>
              ) : (
                <span
                  className="size-8 shrink-0 rounded-full ring-2 ring-white/30"
                  style={{ backgroundColor: lesson.subjectTextColor }}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{lesson.subjectName}</p>
                {slotTimes ? (
                  <p className="truncate text-xs font-medium tabular-nums opacity-90">
                    {formatLocalizedTimeRange(
                      slotTimes.startTime,
                      slotTimes.endTime,
                      timeFormat,
                      locale,
                    )}{" "}
                    {tTimetable("slotDurationMins", {
                      count: slotDurationMinutes(slotTimes.startTime, slotTimes.endTime),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            {lesson.lessonUrl && isValidHttpUrl(lesson.lessonUrl) ? (
              <a
                href={lesson.lessonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                {tTimetable("openLessonUrl")}
              </a>
            ) : null}
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (value === "agenda" || value === "materials" || value === "resources") {
                  setTab(value);
                }
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="agenda">{tTimetable("agendaSection")}</TabsTrigger>
                <TabsTrigger value="materials">{tTimetable("materialsSection")}</TabsTrigger>
                <TabsTrigger value="resources">{tTimetable("resourcesSection")}</TabsTrigger>
              </TabsList>
              <TabsContent value="agenda" className="min-h-16">
                <LessonAgendaList
                  classId={classId}
                  items={lesson.agenda}
                  empty={tTimetable("noAgenda")}
                  assignments={assignmentsQuery.data}
                  tasks={tasksQuery.data}
                  studentUserId={studentUserId}
                />
              </TabsContent>
              <TabsContent value="materials" className="min-h-16">
                <LessonItemList items={lesson.materials} empty={tTimetable("noMaterials")} />
              </TabsContent>
              <TabsContent value="resources" className="min-h-16">
                <LessonResourceList items={lesson.resources} empty={tTimetable("noResources")} />
              </TabsContent>
            </Tabs>
          </>
        ) : quickText ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{quickTextTitle}</p>
            {quickText.startsWith("{") ? (
              <AnnouncementBody bodyJson={quickText} />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{quickText}</p>
            )}
          </div>
        ) : null}
      </div>
    </DashboardSectionCard>
  );
}

function LessonAgendaList({
  classId,
  items,
  empty,
  assignments,
  tasks,
  studentUserId,
}: {
  classId: Id<"classes">;
  items: Array<{
    key: string;
    text: string;
    preface?: string;
    assignmentId?: string;
    taskId?: string;
    assignmentName?: string;
    taskName?: string;
  }>;
  empty: string;
  assignments: AssignmentListItem[] | undefined;
  tasks: TaskListItem[] | undefined;
  studentUserId: Id<"users"> | null;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="flex flex-col gap-2 text-sm">
      {items.map((item, index) => (
        <li key={item.key} className="flex min-w-0 gap-1">
          <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
          <div className="min-w-0 flex-1">
            <TimetableAgendaItemView
              classId={classId}
              text={item.text}
              preface={item.preface}
              assignmentId={item.assignmentId}
              taskId={item.taskId}
              assignmentName={
                item.assignmentName ?? findAgendaResourceName(assignments, item.assignmentId)
              }
              taskName={item.taskName ?? findAgendaResourceName(tasks, item.taskId)}
              assignmentStatus={
                studentUserId
                  ? assignmentStatusForStudent(assignments, item.assignmentId, studentUserId)
                  : undefined
              }
              taskStatus={
                studentUserId ? taskStatusForStudent(tasks, item.taskId, studentUserId) : undefined
              }
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function LessonResourceList({
  items,
  empty,
}: {
  items: Array<{ key: string; url: string; label?: string }>;
  empty: string;
}) {
  const visible = items.filter((item) => isValidHttpUrl(item.url));
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="flex flex-col gap-1 text-sm">
      {visible.map((item, index) => (
        <li key={item.key}>
          {index + 1}.{" "}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {item.label?.trim() || item.url}
          </a>
        </li>
      ))}
    </ol>
  );
}

function LessonItemList({
  items,
  empty,
}: {
  items: Array<{ key: string; text: string }>;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="flex flex-col gap-1 text-sm">
      {items.map((item, index) => (
        <li key={item.key}>
          {index + 1}. <TimetableTaggedText text={item.text} />
        </li>
      ))}
    </ol>
  );
}

function assignmentStatusForStudent(
  assignments: AssignmentListItem[] | undefined,
  assignmentId: string | undefined,
  studentUserId: Id<"users">,
): ReactNode {
  if (!assignmentId) return undefined;
  const assignment = assignments?.find((item) => String(item._id) === String(assignmentId));
  if (!assignment) return undefined;
  const pastDue = isAssignmentPastDue(assignment.dueDateKey);
  const handIn =
    assignment.acceptLinkSubmissions !== false ? (
      <AssignmentHandInStatusBadge
        className="shrink-0"
        handedIn={isStudentAssignmentHandedIn(assignment, studentUserId)}
        pastDue={pastDue}
      />
    ) : pastDue ? (
      <AssignmentHandInStatusBadge className="shrink-0" showHandIn={false} pastDue />
    ) : null;
  const gradingStatus = assignmentGradingStatusForStudent(assignment, studentUserId);
  if (!handIn && !gradingStatus) return undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {handIn}
      <AssignmentGradingStatusBadge className="shrink-0" status={gradingStatus} />
    </span>
  );
}

function taskStatusForStudent(
  tasks: TaskListItem[] | undefined,
  taskId: string | undefined,
  studentUserId: Id<"users">,
): ReactNode {
  if (!taskId) return undefined;
  const task = tasks?.find((item) => String(item._id) === String(taskId));
  if (!task) return undefined;
  return (
    <TaskCompletionStatusBadge
      className="shrink-0"
      completed={areAllStudentsCompleteOnTask(task, [studentUserId])}
      pastDue={isTaskPastDue(task.dueDateKey)}
    />
  );
}
