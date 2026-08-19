import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AttendanceDraftStatus } from "@/lib/attendance/attendance";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/user/userDisplay";
import { sanitizeAvatarUrl } from "../../../convex/lib/avatarUrl";

type AttendanceStudentCardProps = {
  student: StudentRosterEntry;
  status: AttendanceDraftStatus;
  nameFormat?: RosterNameFormat;
  onCycle: () => void;
};

const STATUS_CARD_CLASS: Record<AttendanceDraftStatus, string> = {
  unset: "border-border bg-card hover:bg-muted/40",
  present: "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/15",
  absent: "border-destructive/50 bg-destructive/10 hover:bg-destructive/15",
  late: "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15",
};

const STATUS_BADGE_CLASS: Record<AttendanceDraftStatus, string> = {
  unset: "bg-muted text-muted-foreground",
  present: "bg-emerald-600 text-white",
  absent: "bg-destructive text-destructive-foreground",
  late: "bg-amber-600 text-white",
};

export function AttendanceStudentCard({
  student,
  status,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
  onCycle,
}: AttendanceStudentCardProps) {
  const { t } = useTranslation("attendance");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
  const initials = getInitials({
    _id: student.userId,
    name: displayName,
    email: student.email,
  });
  const safeImage = sanitizeAvatarUrl(student.image);
  const statusLabel =
    status === "unset"
      ? t("statusUnset")
      : status === "present"
        ? t("statusPresent")
        : status === "absent"
          ? t("statusAbsent")
          : t("statusLate");

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={t("cycleStatusAria", { name: displayName, status: statusLabel })}
      className={cn(
        "flex h-full w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        STATUS_CARD_CLASS[status],
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {safeImage ? <AvatarImage src={safeImage} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
              {student.rosterNumber}
            </span>
            <p className="truncate font-medium">{displayName}</p>
          </div>
          <span
            className={cn(
              "mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_CLASS[status],
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
