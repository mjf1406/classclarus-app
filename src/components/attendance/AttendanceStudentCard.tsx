import { Check, Clock, X } from "lucide-react";

import type { AttendanceDraftStatus } from "@/lib/attendance/attendance";
import { cn } from "@/lib/utils";

/** 3 cols always; 6.5rem cap keeps compact squares on wide viewports. */
export const ATTENDANCE_STUDENT_GRID_CLASS =
  "grid w-fit max-w-full gap-1.5 [grid-template-columns:repeat(3,minmax(0,6.5rem))] sm:gap-2";

type AttendanceStudentCardProps = {
  name: string;
  status: AttendanceDraftStatus;
  ariaLabel: string;
  onCycle: () => void;
};

const STATUS_CARD_CLASS: Record<AttendanceDraftStatus, string> = {
  unset: "bg-card hover:bg-accent/40",
  present: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90",
  absent: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
  late: "border-amber-600 bg-amber-600 text-white hover:bg-amber-600/90",
};

const STATUS_ICON = {
  present: Check,
  absent: X,
  late: Clock,
} as const;

export function AttendanceStudentCard({
  name,
  status,
  ariaLabel,
  onCycle,
}: AttendanceStudentCardProps) {
  const Icon = status === "unset" ? null : STATUS_ICON[status];

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={ariaLabel}
      data-status={status}
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-1.5 py-2 text-center transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        STATUS_CARD_CLASS[status],
      )}
    >
      {Icon ? <Icon className="absolute top-1 left-1 size-3" strokeWidth={3} aria-hidden /> : null}
      <span className="line-clamp-2 text-xs leading-tight font-semibold tracking-tight break-words sm:text-sm">
        {name}
      </span>
    </button>
  );
}
