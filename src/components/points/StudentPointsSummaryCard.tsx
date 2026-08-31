import { AwardIcon, FlagIcon, GiftIcon, TriangleAlertIcon, TrophyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  genderLabelKey,
  getRosterDisplayName,
  pronounLabelKey,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { isAbsentStudent, type PointsBoardStudent } from "@/lib/points/points";
import { cn } from "@/lib/utils";

function attendanceLabelKey(
  status: PointsBoardStudent["attendanceStatus"],
): "statusPresent" | "statusAbsent" | "statusLate" | "statusUnset" {
  if (status === "present") return "statusPresent";
  if (status === "absent") return "statusAbsent";
  if (status === "late") return "statusLate";
  return "statusUnset";
}

type StudentPointsSummaryCardProps = {
  student: PointsBoardStudent;
  nameFormat: RosterNameFormat;
};

export function StudentPointsSummaryCard({ student, nameFormat }: StudentPointsSummaryCardProps) {
  const { t } = useTranslation("points");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
  const absent = isAbsentStudent(student);
  const attendanceKey = attendanceLabelKey(student.attendanceStatus);
  const genderLabel = student.gender
    ? student.gender === "selfDescribe" && student.genderSelfDescribe
      ? student.genderSelfDescribe
      : tClasses(genderLabelKey(student.gender))
    : null;
  const pronounsLabel = student.pronouns
    ? student.pronouns === "askSelfDescribe" && student.pronounsSelfDescribe
      ? student.pronounsSelfDescribe
      : tClasses(pronounLabelKey(student.pronouns))
    : null;
  const metaLine = [genderLabel, pronounsLabel].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col gap-3 rounded-2xl border p-4",
        absent && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <p className="truncate font-medium">{displayName}</p>
          </div>
          <span className="mt-1 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {tAttendance(attendanceKey)}
          </span>
          {metaLine ? <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p> : null}
        </div>
        {student.warningCount > 0 || student.minusCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-2">
            {student.warningCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <TriangleAlertIcon className="size-4" aria-hidden />
                <span className="text-sm font-semibold tabular-nums">{student.warningCount}</span>
                <span className="sr-only">
                  {t("warningsCount", { count: student.warningCount })}
                </span>
              </span>
            ) : null}
            {student.minusCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <FlagIcon className="size-4" aria-hidden />
                <span className="text-sm font-semibold tabular-nums">{student.minusCount}</span>
                <span className="sr-only">{t("minusCount", { count: student.minusCount })}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        <div
          className="flex items-center gap-2 text-lg font-semibold tabular-nums"
          aria-label={t("statBalanceAria", { count: student.pointsBalance })}
        >
          <TrophyIcon className="size-5 shrink-0 text-amber-400" aria-hidden />
          <span>{t("pointsBalance", { count: student.pointsBalance })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statAwardedAria", { count: student.pointsAwarded })}
          >
            <AwardIcon className="size-4 shrink-0 text-amber-500/90" aria-hidden />
            <span>{student.pointsAwarded}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statRemovedAria", { count: student.pointsRemoved })}
          >
            <FlagIcon className="size-4 shrink-0 text-rose-500/90" aria-hidden />
            <span>{student.pointsRemoved === 0 ? 0 : -student.pointsRemoved}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={t("statRedeemedAria", { count: student.pointsRedeemed })}
          >
            <GiftIcon className="size-4 shrink-0 text-emerald-500/90" aria-hidden />
            <span>{student.pointsRedeemed}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
