import {
  CheckCircle2Icon,
  CheckSquareIcon,
  FlagIcon,
  TriangleAlertIcon,
  TrophyIcon,
  Undo2Icon,
  UserXIcon,
  XCircleIcon,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  genderLabelKey,
  getRosterDisplayName,
  pronounLabelKey,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { isAbsentStudent, type PointsBoardStudent } from "@/lib/points/points";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 8;

type PointStudentCardProps = {
  student: PointsBoardStudent;
  nameFormat: RosterNameFormat;
  selectMode: boolean;
  selected: boolean;
  canManageAttendance: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onLongPressSelect: () => void;
  onGiveWarning: () => void;
  onUndoWarning: () => void;
  onClearWarnings: () => void;
  onMarkAbsent: () => void;
  onMarkPresent: () => void;
  onUndoPoints: () => void | Promise<void>;
};

export function PointStudentCard({
  student,
  nameFormat,
  selectMode,
  selected,
  canManageAttendance,
  onOpen,
  onToggleSelect,
  onLongPressSelect,
  onGiveWarning,
  onUndoWarning,
  onClearWarnings,
  onMarkAbsent,
  onMarkPresent,
  onUndoPoints,
}: PointStudentCardProps) {
  const { t } = useTranslation("points");
  const { t: tClasses } = useTranslation("classes");
  // Points cards always show first name only (hide surname for denser grid).
  const displayName = getRosterDisplayName(
    { ...student, lastName: undefined },
    tClasses("unnamedMember"),
    nameFormat,
  );
  const absent = isAbsentStudent(student);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const endLongPressGesture = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
  };

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

  const menuItems = useMemo<Array<ActionMenuItem>>(() => {
    const items: Array<ActionMenuItem> = [
      {
        id: "select",
        label: t("menuSelectStudent"),
        icon: <CheckSquareIcon />,
        permission: "points:manage",
        group: "selection",
        onSelect: onLongPressSelect,
      },
      {
        id: "warning",
        label: t("menuGiveWarning"),
        icon: <TriangleAlertIcon />,
        permission: "points:manage",
        group: "warnings",
        onSelect: onGiveWarning,
      },
      {
        id: "undoWarning",
        label: t("menuUndoWarning"),
        icon: <Undo2Icon />,
        permission: "points:manage",
        group: "warnings",
        onSelect: onUndoWarning,
      },
      {
        id: "clearWarnings",
        label: t("menuClearWarnings"),
        icon: <XCircleIcon />,
        permission: "points:manage",
        group: "warnings",
        onSelect: onClearWarnings,
      },
    ];
    if (canManageAttendance) {
      items.push(
        absent
          ? {
              id: "present",
              label: t("menuMarkPresent"),
              icon: <CheckCircle2Icon />,
              permission: "attendance:manage",
              group: "attendance",
              onSelect: onMarkPresent,
            }
          : {
              id: "absent",
              label: t("menuMarkAbsent"),
              icon: <UserXIcon />,
              permission: "attendance:manage",
              group: "attendance",
              onSelect: onMarkAbsent,
            },
      );
    }
    items.push({
      id: "undoPoints",
      label: t("menuUndoPoints"),
      icon: <Undo2Icon />,
      permission: "points:manage",
      group: "points",
      onSelect: onUndoPoints,
    });
    return items;
  }, [
    absent,
    canManageAttendance,
    onClearWarnings,
    onGiveWarning,
    onLongPressSelect,
    onMarkAbsent,
    onMarkPresent,
    onUndoPoints,
    onUndoWarning,
    t,
  ]);

  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border p-1.5 transition-[opacity,border-color] sm:p-2",
        selected && "border-dashed border-primary",
        absent && "opacity-40",
      )}
    >
      <div className="absolute top-1 left-1 z-10 flex items-center gap-1 sm:top-1.5 sm:left-1.5 sm:gap-1.5">
        {selectMode ? (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect()}
            aria-label={t("selectStudentAria", { name: displayName })}
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
        <span className="inline-flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tabular-nums sm:size-6">
          {student.rosterNumber}
        </span>
      </div>

      <div className="absolute top-1 right-1 z-10 sm:top-1.5 sm:right-1.5">
        <ActionMenu items={menuItems} label={t("cardActionsAria", { name: displayName })} />
      </div>

      <button
        type="button"
        className="flex min-h-0 flex-1 touch-manipulation select-none flex-col items-center justify-center px-4 py-3 text-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-5 sm:py-4"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          didLongPressRef.current = false;
          clearLongPressTimer();
          pointerStartRef.current = { x: event.clientX, y: event.clientY };
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            pointerStartRef.current = null;
            didLongPressRef.current = true;
            onLongPressSelect();
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(event) => {
          const start = pointerStartRef.current;
          if (!start || longPressTimerRef.current === null) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (dx * dx + dy * dy > LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX) {
            endLongPressGesture();
          }
        }}
        onPointerUp={endLongPressGesture}
        onPointerCancel={endLongPressGesture}
        onPointerLeave={endLongPressGesture}
        onContextMenu={(event) => {
          // Avoid the native long-press menu on touch devices.
          event.preventDefault();
        }}
        onClick={() => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false;
            return;
          }
          if (selectMode) {
            onToggleSelect();
            return;
          }
          onOpen();
        }}
      >
        <span className="line-clamp-2 text-[11px] leading-tight font-semibold tracking-tight break-words sm:text-xs">
          {displayName}
        </span>
        {metaLine ? (
          <span className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
            {metaLine}
          </span>
        ) : null}
      </button>

      <div className="pointer-events-none absolute right-1.5 bottom-1.5 left-1.5 flex items-end justify-between sm:right-2 sm:bottom-2 sm:left-2">
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums sm:gap-1 sm:text-xs">
          <TrophyIcon className="size-3 text-amber-400 sm:size-3.5" aria-hidden="true" />
          {student.pointsBalance}
        </span>
        {student.warningCount > 0 || student.minusCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 sm:gap-2">
            {student.warningCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <TriangleAlertIcon className="size-3 sm:size-3.5" aria-hidden="true" />
                <span className="text-[11px] font-semibold tabular-nums sm:text-xs">
                  {student.warningCount}
                </span>
                <span className="sr-only">
                  {t("warningsCount", { count: student.warningCount })}
                </span>
              </span>
            ) : null}
            {student.minusCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <FlagIcon className="size-3 sm:size-3.5" aria-hidden="true" />
                <span className="text-[11px] font-semibold tabular-nums sm:text-xs">
                  {student.minusCount}
                </span>
                <span className="sr-only">{t("minusCount", { count: student.minusCount })}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
