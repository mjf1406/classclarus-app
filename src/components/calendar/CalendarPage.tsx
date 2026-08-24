import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendarEventsInRange } from "@/hooks/calendar/useCalendarEventsInRange";
import { useCreateCalendarEvent } from "@/hooks/calendar/useCreateCalendarEvent";
import { useRemoveCalendarEvent } from "@/hooks/calendar/useRemoveCalendarEvent";
import { useUpdateCalendarEvent } from "@/hooks/calendar/useUpdateCalendarEvent";
import { useCan } from "@/hooks/permissions/useCan";
import { useClass } from "@/hooks/classes/useClass";
import { useSetTimezone } from "@/hooks/classes/useSetTimezone";
import {
  dateKeyToLocalDate,
  dateKeyForYearMonth,
  eventSortKey,
  formatDateKeyLocalized,
  formatEventTimeLabel,
  localDateToDateKey,
  type CalendarEvent,
  type CalendarEventSubmitValues,
} from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { eventOverlapsDateKey } from "../../../convex/lib/calendar/overlap";
import {
  buildMonthGrid,
  classNowDateKey,
  dateKeyYearMonth,
  monthRangeUtc,
  shiftYearMonth,
} from "../../../convex/lib/calendar/monthGrid";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type CalendarPageProps = {
  classId: Id<"classes">;
};

function formatMonthTitle(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

const MONTH_DAY_CHIP_LIMIT = 3;

type CalendarMonthDayContextValue = {
  eventsByDateKey: Map<string, Array<CalendarEvent>>;
  eventsOnDayLabel: (count: number) => string;
};

const CalendarMonthDayContext = createContext<CalendarMonthDayContextValue | null>(null);

function CalendarMonthDayButton({
  className,
  day,
  ...props
}: ComponentProps<typeof CalendarDayButton>) {
  const ctx = useContext(CalendarMonthDayContext);
  const dateKey = localDateToDateKey(day.date);
  const dayEvents = ctx?.eventsByDateKey.get(dateKey) ?? [];
  const chips = dayEvents.slice(0, MONTH_DAY_CHIP_LIMIT);
  const extraCount = dayEvents.length - chips.length;

  return (
    <CalendarDayButton
      day={day}
      {...props}
      className={cn(
        "aspect-square h-full min-h-0 min-w-0 overflow-hidden rounded-full p-0 whitespace-normal",
        "items-center justify-center gap-0.5 md:aspect-auto md:min-h-20 md:items-start md:justify-start md:rounded-lg md:p-1",
        "[&>span]:text-inherit [&>span]:opacity-100",
        className,
      )}
    >
      <span className="text-sm leading-none font-medium md:self-end md:text-xs md:font-normal">
        {day.date.getDate()}
      </span>
      {dayEvents.length > 0 ? (
        <span className="sr-only">{ctx?.eventsOnDayLabel(dayEvents.length)}</span>
      ) : null}
      {dayEvents.length > 0 ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5 md:hidden"
        >
          {dayEvents.slice(0, MONTH_DAY_CHIP_LIMIT).map((event) => (
            <span
              key={event._id}
              className="size-1 shrink-0 rounded-full bg-primary group-data-[selected-single=true]/button:bg-primary-foreground"
            />
          ))}
        </span>
      ) : null}
      <span className="hidden min-h-0 w-full min-w-0 flex-1 flex-col gap-0.5 overflow-hidden md:flex">
        {chips.map((event) => (
          <span
            key={event._id}
            className="truncate rounded-sm bg-primary/15 px-1 text-[10px] leading-4 text-foreground group-data-[selected-single=true]/button:bg-primary-foreground/20 group-data-[selected-single=true]/button:text-primary-foreground"
          >
            {event.title}
          </span>
        ))}
        {extraCount > 0 ? (
          <span className="px-1 text-[10px] leading-4 text-muted-foreground group-data-[selected-single=true]/button:text-primary-foreground/80">
            +{extraCount}
          </span>
        ) : null}
      </span>
    </CalendarDayButton>
  );
}

export function CalendarPage({ classId }: CalendarPageProps) {
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

  useEffect(() => {
    if (!classTimeZone || !isValidTimeZone(classTimeZone)) return;
    if (initializedZoneRef.current === classTimeZone) return;
    const firstLoad = initializedZoneRef.current === undefined;
    initializedZoneRef.current = classTimeZone;
    if (!firstLoad) return;
    const key = classNowDateKey(Date.now(), classTimeZone);
    const next = dateKeyYearMonth(key);
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey(key);
  }, [classTimeZone]);

  const range = monthRangeUtc(year, month, zone);
  const { data, isPending, isError, refetch, isAuthLoading } = useCalendarEventsInRange(
    classId,
    range.rangeStartMs,
    range.rangeEndMs,
  );
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const removeEvent = useRemoveCalendarEvent();

  const events = useMemo(() => data ?? [], [data]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, Array<CalendarEvent>>();
    for (const cell of buildMonthGrid(year, month)) {
      const list = events
        .filter((event) => eventOverlapsDateKey(event, cell.dateKey, zone))
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
      if (list.length > 0) {
        map.set(cell.dateKey, list);
      }
    }
    return map;
  }, [events, month, year, zone]);

  const monthDate = dateKeyToLocalDate(`${year}-${String(month).padStart(2, "0")}-01`);
  const selectedDate = dateKeyToLocalDate(selectedDateKey);
  const dayEvents = eventsByDateKey.get(selectedDateKey) ?? [];

  const agendaEvents = useMemo(
    () => [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [events],
  );

  const monthDayContext = useMemo<CalendarMonthDayContextValue>(
    () => ({
      eventsByDateKey,
      eventsOnDayLabel: (count) => t("eventsOnDay", { count }),
    }),
    [eventsByDateKey, t],
  );

  const goToMonth = (next: { year: number; month: number }) => {
    setYear(next.year);
    setMonth(next.month);
    setSelectedDateKey((current) => dateKeyForYearMonth(current, next.year, next.month));
  };

  const openCreate = (dateKey = selectedDateKey) => {
    setEditing(null);
    setSelectedDateKey(dateKey);
    setFormOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditing(event);
    setFormOpen(true);
  };

  const handleSubmit = async (values: CalendarEventSubmitValues) => {
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

  const showSkeleton = (isPending || isAuthLoading) && data == null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canManage ? (
          <Button type="button" className="w-full sm:w-auto" onClick={() => openCreate()}>
            <PlusIcon data-icon="inline-start" />
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("previousMonth")}
            onClick={() => goToMonth(shiftYearMonth(year, month, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("nextMonth")}
            onClick={() => goToMonth(shiftYearMonth(year, month, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-base font-medium sm:text-lg">
            {formatMonthTitle(year, month, locale)}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
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
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto">
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
        <Skeleton className="h-72 w-full rounded-2xl md:h-[32rem]" />
      ) : (
        <>
          {view === "month" ? (
            <Card size="sm" className="gap-0 py-2">
              <CardContent className="px-1 sm:px-2">
                <CalendarMonthDayContext.Provider value={monthDayContext}>
                  <Calendar
                    mode="single"
                    month={monthDate}
                    onMonthChange={(date) => {
                      goToMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
                    }}
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) setSelectedDateKey(localDateToDateKey(date));
                    }}
                    today={dateKeyToLocalDate(todayKey)}
                    showOutsideDays
                    className="w-full bg-transparent p-1 [--cell-size:--spacing(9)] md:p-2 md:[--cell-size:--spacing(16)]"
                    classNames={{
                      root: "w-full",
                      month: "w-full gap-2 md:gap-4",
                      month_grid: "w-full",
                      weekdays: "grid w-full grid-cols-7",
                      weekday: "min-w-0 w-full text-center",
                      week: "mt-1 grid w-full grid-cols-7 md:mt-2",
                      day: "relative aspect-square h-auto min-w-0 w-full overflow-hidden p-0.5 md:aspect-auto md:h-24",
                      nav: "hidden",
                      month_caption: "hidden",
                    }}
                    components={{ DayButton: CalendarMonthDayButton }}
                  />
                </CalendarMonthDayContext.Provider>
              </CardContent>
            </Card>
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
                    classId={classId}
                    event={event}
                    timeLabel={formatEventTimeLabel(event, zone, locale)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => setDeleting(event)}
                  />
                ))}
              </ul>
            )
          ) : (
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>{formatDateKeyLocalized(selectedDateKey, locale)}</CardTitle>
              </CardHeader>
              <CardContent>
                {dayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noEventsThisDay")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {dayEvents.map((event) => (
                      <EventRow
                        key={event._id}
                        classId={classId}
                        event={event}
                        timeLabel={formatEventTimeLabel(event, zone, locale)}
                        onEdit={() => openEdit(event)}
                        onDelete={() => setDeleting(event)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
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
        classId={classId}
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
  classId,
  event,
  timeLabel,
  onEdit,
  onDelete,
}: {
  classId: Id<"classes">;
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
      <Link
        to="/class/$classId/calendar/event/$eventId"
        params={{ classId, eventId: event._id }}
        className="min-w-0 flex-1 rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="truncate font-medium">{event.title}</div>
        <div className="truncate text-xs text-muted-foreground">{timeLabel}</div>
      </Link>
      <ActionMenu items={menuItems} label={t("actions")} />
    </li>
  );
}
