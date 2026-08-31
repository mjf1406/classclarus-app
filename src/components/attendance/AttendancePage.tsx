import { ClipboardCheck, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ATTENDANCE_STUDENT_GRID_CLASS,
  AttendanceStudentCard,
} from "@/components/attendance/AttendanceStudentCard";
import { PersonalAttendancePage } from "@/components/attendance/PersonalAttendancePage";
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
import { useAttendanceForDate } from "@/hooks/attendance/useAttendanceForDate";
import { useSaveAttendanceForDate } from "@/hooks/attendance/useSaveAttendanceForDate";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import { useEnsureStudentRosters } from "@/hooks/roster/useEnsureStudentRosters";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import {
  cycleAttendanceStatus,
  draftForRoster,
  isAttendanceDraftDirty,
  recordsPayloadFromDraft,
  type AttendanceStatus,
} from "@/lib/attendance/attendance";
import { localDateKey } from "@/lib/attendance/dateKey";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import {
  compactRosterDisplayNames,
  getRosterDisplayName,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

type AttendancePageProps = {
  classId: Id<"classes">;
};

export function AttendancePage({ classId }: AttendancePageProps) {
  const { can, isPending: permissionsPending } = useCan();

  if (permissionsPending) {
    return <PendingComponent />;
  }
  if (!can("attendance:manage")) {
    return <PersonalAttendancePage classId={classId} />;
  }

  return <StaffAttendancePage classId={classId} />;
}

function StaffAttendancePage({ classId }: AttendancePageProps) {
  const { t } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const unnamed = tClasses("unnamedMember");
  const dateKey = useMemo(() => localDateKey(), []);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const {
    data: students,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
    isAuthLoading,
  } = useStudentRoster(classId);
  const {
    data: attendance,
    isPending: attendancePending,
    isError: attendanceError,
    refetch: refetchAttendance,
  } = useAttendanceForDate(classId, dateKey);
  const { data: groupsBoard } = useGroupsBoard(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);
  const saveAttendance = useSaveAttendanceForDate();

  useEnsureStudentRosters(classId, !rosterPending && !isAuthLoading && !rosterError);

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );
  const compactNames = useMemo(
    () => compactRosterDisplayNames(students ?? [], unnamed, nameFormat),
    [nameFormat, students, unnamed],
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
  const { filtered } = useStudentRosterFilter({
    members: students,
    query: "",
    membershipByUserId,
    filterState,
  });

  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [dirty, setDirty] = useState(false);

  const rosterUserIds = useMemo(
    () => (students ?? []).map((student) => student.userId as string),
    [students],
  );

  useEffect(() => {
    if (dirty || !attendance || students === undefined) return;
    setDraft(draftForRoster(rosterUserIds, attendance.records));
  }, [attendance, dirty, rosterUserIds, students]);

  const isDirty = useMemo(
    () => (attendance ? isAttendanceDraftDirty(draft, attendance.records) : dirty),
    [attendance, draft, dirty],
  );

  const isPending = rosterPending || attendancePending;
  const isError = rosterError || attendanceError;

  const handleCycle = (student: StudentRosterEntry) => {
    const current = draft[student.userId] ?? "present";
    const next = cycleAttendanceStatus(current);
    setDraft((prev) => ({ ...prev, [student.userId]: next }));
    setDirty(true);
  };

  const handleSave = () => {
    saveAttendance.mutate(
      {
        classId,
        dateKey,
        records: recordsPayloadFromDraft(draft),
      },
      {
        onSuccess: () => {
          setDirty(false);
        },
      },
    );
  };

  const handleRetry = () => {
    void refetchRoster();
    void refetchAttendance();
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="hidden text-muted-foreground sm:block">
            {t("description", { date: dateKey })}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveAttendance.isPending || isPending || isError}
        >
          <ClipboardCheck className="size-4" />
          {saveAttendance.isPending ? t("saving") : t("saveAction")}
        </Button>
      </div>

      <GroupTeamFilterButtons classId={classId} />

      {isPending ? (
        <div className={ATTENDANCE_STUDENT_GRID_CLASS}>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={handleRetry}
        />
      ) : null}

      {!isPending && !isError && filtered.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && filtered.length > 0 ? (
        <ul className={ATTENDANCE_STUDENT_GRID_CLASS}>
          {filtered.map((student) => {
            const status = draft[student.userId] ?? "present";
            const compactName = compactNames.get(student.userId) ?? unnamed;
            const displayName = getRosterDisplayName(student, unnamed, nameFormat);
            const statusLabel =
              status === "present"
                ? t("statusPresent")
                : status === "absent"
                  ? t("statusAbsent")
                  : status === "late"
                    ? t("statusLate")
                    : t("statusUnset");
            return (
              <li key={student.userId}>
                <AttendanceStudentCard
                  name={compactName}
                  status={status}
                  ariaLabel={t("cycleStatusAria", { name: displayName, status: statusLabel })}
                  onCycle={() => handleCycle(student)}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
