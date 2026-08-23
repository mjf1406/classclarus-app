import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DayButtonProps } from "react-day-picker";

import { CalendarEventFormCredenza } from "@/components/calendar/CalendarEventFormCredenza";
import { CalendarTimezoneCredenza } from "@/components/calendar/CalendarTimezoneCredenza";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendarEvent } from "@/hooks/calendar/useCalendarEvent";
import { useCalendarEventsInRange } from "@/hooks/calendar/useCalendarEventsInRange";
import { useCreateCalendarEvent } from "@/hooks/calendar/useCreateCalendarEvent";
import { useRemoveCalendarEvent } from "@/hooks/calendar/useRemoveCalendarEvent";
import { useUpdateCalendarEvent } from "@/hooks/calendar/useUpdateCalendarEvent";
import { useCan } from "@/hooks/permissions/useCan";
import { useClass } from "@/hooks/classes/useClass";
import { useSetTimezone } from "@/hooks/classes/useSetTimezone";
import {
  dateKeyToLocalDate,
  eventSortKey,
  formatDateKeyLocalized,
  formatEventTimeLabel,
  localDateToDateKey,
  type CalendarEvent,
} from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { eventOverlapsDateKey } from "../../../convex/lib/calendar/overlap";
import {
  classNowDateKey,
  dateKeyYearMonth,
  monthRangeUtc,
  shiftYearMonth,
} from "../../../convex/lib/calendar/monthGrid";
import { isValidTimeZone, utcMsToZonedParts } from "../../../convex/lib/calendar/timeZone";
import type { CalendarEventFormValues } from "../../../convex/lib/calendar/calendarEventSchema";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type CalendarPageProps = {
  classId: Id<"classes">;
  eventId?: Id<"calendarEvents">;
};

function formatMonthTitle(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

export function CalendarPage({ classId, eventId }: CalendarPageProps) {
  const { t, i18n } = useTranslation("calendar");
  const locale = toIntlLocale(i18n.language);
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("calendar:manage");
  const canUpdateClass = !permissionsPending && can("class:update");
  const { data: classDoc } = useClass(classId);
  const setTimezone = useSetTimezone();
  const classTimeZone = classDoc?.timezone;
  const zone = classTimeZone && isValidTimeZone(classTimeZone) ? classTimeZone : "UTC";
  const todayKey = classNowDateKey(Date.now(), zone);
  const todayParts = todayKey.split("-").map(Number);
  const [year, setYear] = useState(todayParts[0] ?? new Date().getFullYear());
  const [month, setMonth] = useState(todayParts[1] ?? new Date().getMonth() + 1);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [formOpen, setFormOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const initializedZoneRef = useRef<string | undefined>(undefined);
  const openedEventRef = useRef<string | null>(null);

  useEffect(() => {
    if (!classTimeZone || !isValidTimeZone(classTimeZone)) return;
    if (initializedZoneRef.current === classTimeZone) return;
    const firstLoad = initializedZoneRef.current === undefined;
    initializedZoneRef.current = classTimeZone;
    if (!firstLoad || eventId) return;
    const key = classNowDateKey(Date.now(), classTimeZone);
    const next = dateKeyYearMonth(key);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(key);
  }, [classTimeZone, eventId]);

  const range = monthRangeUtc(year, month, zone);
  const { data, isPending, isError, refetch, isAuthLoading } = useCalendarEventsInRange(
    classId,
    range.rangeStartMs,
    range.rangeEndMs,
  );
  const { data: focusEvent } = useCalendarEvent(classId, eventId);
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const removeEvent = useRemoveCalendarEvent();

  const events = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!eventId || !focusEvent || openedEventRef.current === eventId) return;
    openedEventRef.current = eventId;
    const dateKey =
      focusEvent.startDateKey ??
      (focusEvent.startAt !== undefined
        ? utcMsToZonedParts(focusEvent.startAt, zone).dateKey
        : undefined);
    if (dateKey) {
      const next = dateKeyYearMonth(dateKey);
      setYear(next.year);
      setMonth(next.month);
      setSelectedDateKey(dateKey);
    }
    setEditing(focusEvent);
    setFormOpen(true);
  }, [eventId, focusEvent, zone]);

  const monthDate = dateKeyToLocalDate(`${year}-${String(month).padStart(2, "0")}-01`);
  const selectedDate = dateKeyToLocalDate(selectedDateKey);

  const dayEvents = useMemo(
    () =>
      events
        .filter((event) => eventOverlapsDateKey(event, selectedDateKey, zone))
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [events, selectedDateKey, zone],
  );

  const agendaEvents = useMemo(
    () => [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [events],
  );

  const openCreate = (dateKey = selectedDateKey) => {
    setEditing(null);
    setSelectedDateKey(dateKey);
    setFormOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditing(event);
    setFormOpen(true);
  };

  const handleSubmit = async (values: CalendarEventFormValues) => {
    if (editing) {
      await updateEvent.mutateAsync({
        ...values,
        classId,
        eventId: editing._id,
        classTimeZone,
      });
    } else {
      await createEvent.mutateAsync({
        ...values,
        classId,
        classTimeZone,
      });
    }
  };

  const MonthDayButton = (props: DayButtonProps) => {
    const dateKey = localDateToDateKey(props.day.date);
    const dayList = events
      .filter((event) => eventOverlapsDateKey(event, dateKey, zone))
      .slice(0, 3);
    return (
      <CalendarDayButton
        {...props}
        className={cn("h-full min-h-16 items-start justify-start p-1", props.className)}
      >
        <span className="self-end text-xs">{props.day.date.getDate()}</span>
        <span className="flex w-full flex-col gap-0.5">
          {dayList.map((event) => (
            <span
              key={event._id}
              className="truncate rounded-sm bg-primary/15 px-1 text-[10px] leading-4 text-foreground"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openEdit(event);
              }}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                  keyEvent.stopPropagation();
                  openEdit(event);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {event.title}
            </span>
          ))}
        </span>
      </CalendarDayButton>
    );
  };

  const showSkeleton = (isPending || isAuthLoading) && data == null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => openCreate()}>
            <PlusIcon />
            {t("createEvent")}
          </Button>
        ) : null}
      </div>

      {classDoc && !classTimeZone ? (
        <Alert
          variant="warning"
          className={cn(canUpdateClass && "has-[>svg]:grid-cols-[auto_minmax(0,1fr)_auto]")}
        >
          <TriangleAlertIcon className="size-6" />
          <AlertTitle>{t("timezoneRequiredTitle")}</AlertTitle>
          <AlertDescription className="col-start-2">{t("timezoneRequiredBanner")}</AlertDescription>
          {canUpdateClass ? (
            <div className="col-start-3 row-span-2 row-start-1 self-center justify-self-end">
              <span className="inline-flex rounded-4xl bg-background">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTimezoneOpen(true)}
                >
                  {t("setTimezone")}
                </Button>
              </span>
            </div>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("previousMonth")}
            onClick={() => {
              const next = shiftYearMonth(year, month, -1);
              setYear(next.year);
              setMonth(next.month);
            }}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("nextMonth")}
            onClick={() => {
              const next = shiftYearMonth(year, month, 1);
              setYear(next.year);
              setMonth(next.month);
            }}
          >
            <ChevronRightIcon />
          </Button>
          <h2 className="text-lg font-medium">{formatMonthTitle(year, month, locale)}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const parts = todayKey.split("-").map(Number);
              setYear(parts[0] ?? year);
              setMonth(parts[1] ?? month);
              setSelectedDateKey(todayKey);
            }}
          >
            {t("today")}
          </Button>
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (value === "month" || value === "agenda") setView(value);
          }}
        >
          <TabsList>
            <TabsTrigger value="month">{t("viewMonth")}</TabsTrigger>
            <TabsTrigger value="agenda">{t("viewAgenda")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : showSkeleton ? (
        <Skeleton className="h-[32rem] w-full rounded-2xl" />
      ) : (
        <>
          {view === "month" ? (
            <div className="overflow-x-auto rounded-2xl border border-border p-2">
              <Calendar
                mode="single"
                month={monthDate}
                onMonthChange={(date) => {
                  setYear(date.getFullYear());
                  setMonth(date.getMonth() + 1);
                }}
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) setSelectedDateKey(localDateToDateKey(date));
                }}
                today={dateKeyToLocalDate(todayKey)}
                showOutsideDays
                className="w-full [--cell-size:--spacing(16)]"
                classNames={{
                  root: "w-full",
                  month: "w-full",
                  month_grid: "w-full",
                  weekdays: "grid w-full grid-cols-7",
                  weekday: "min-w-0 w-full text-center",
                  week: "grid w-full grid-cols-7",
                  day: "aspect-auto h-20 min-w-0 w-full",
                  nav: "hidden",
                  month_caption: "hidden",
                }}
                components={{ DayButton: MonthDayButton }}
              />
            </div>
          ) : null}

          {view === "agenda" ? (
            agendaEvents.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {agendaEvents.map((event) => (
                  <EventRow
                    key={event._id}
                    event={event}
                    timeLabel={formatEventTimeLabel(event, zone, locale)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => setDeleting(event)}
                  />
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {formatDateKeyLocalized(selectedDateKey, locale)}
              </h3>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noEventsThisDay")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayEvents.map((event) => (
                    <EventRow
                      key={event._id}
                      event={event}
                      timeLabel={formatEventTimeLabel(event, zone, locale)}
                      onEdit={() => openEdit(event)}
                      onDelete={() => setDeleting(event)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <CalendarTimezoneCredenza
        open={timezoneOpen}
        onOpenChange={setTimezoneOpen}
        onSubmit={async (timezone) => {
          await setTimezone.mutateAsync({ classId, timezone });
        }}
      />
      <CalendarEventFormCredenza
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        mode={editing ? "edit" : "create"}
        classTimeZone={classTimeZone}
        todayKey={editing ? eventToCreateDate(editing, todayKey) : selectedDateKey}
        initial={editing}
        onSubmit={handleSubmit}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { name: deleting?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return;
                const event = deleting;
                setDeleting(null);
                void removeEvent.mutateAsync({ classId, eventId: event._id });
              }}
            >
              {t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function eventToCreateDate(event: CalendarEvent, fallback: string): string {
  return event.startDateKey ?? fallback;
}

function EventRow({
  event,
  timeLabel,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  timeLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("calendar");
  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "edit",
        label: t("editAction"),
        icon: <PencilIcon />,
        permission: "calendar:manage",
        group: "manage",
        onSelect: onEdit,
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2Icon />,
        permission: "calendar:manage",
        variant: "destructive",
        group: "danger",
        onSelect: onDelete,
      },
    ],
    [onDelete, onEdit, t],
  );

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <div className="truncate font-medium">{event.title}</div>
        <div className="truncate text-xs text-muted-foreground">{timeLabel}</div>
      </button>
      <ActionMenu items={menuItems} label={t("actions")} />
    </li>
  );
}
