import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRouteApi } from "@tanstack/react-router";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { TimetableLessonSheet } from "@/components/timetable/TimetableLessonSheet";
import { TimetableLinkSlotsCredenza } from "@/components/timetable/TimetableLinkSlotsCredenza";
import { TimetableSlotFormCredenza } from "@/components/timetable/TimetableSlotFormCredenza";
import { TimetableSubjectFormCredenza } from "@/components/timetable/TimetableSubjectFormCredenza";
import {
  TimetableSubjectsSidebarPanel,
  TimetableSubjectsSidebarToggle,
} from "@/components/timetable/TimetableSubjectsSidebar";
import { TimetableTermFormCredenza } from "@/components/timetable/TimetableTermFormCredenza";
import { TimetableTimelineGrid } from "@/components/timetable/TimetableTimelineGrid";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAddLessonToSlot,
  useRemoveLesson,
  useRemoveTimetableSlot,
  useRemoveTimetableSubject,
  useToggleSlotDisabledForWeek,
  useUnlinkSlot,
} from "@/hooks/timetable/useTimetableMutations";
import { useTimetableTerms, useTimetableWeekBundle } from "@/hooks/timetable/useTimetableQueries";
import { useCan } from "@/hooks/permissions/useCan";
import type {
  TimetableLesson,
  TimetableSlot,
  TimetableSubject,
  TimetableTerm,
} from "@/lib/timetable/timetable";
import {
  clampDateToTerm,
  parseTimetableSearch,
  toDateSearchParam,
  type TimetableViewMode,
} from "@/lib/timetable/timetableSearch";
import {
  clampWeekStartToTerm,
  formatDayDate,
  formatWeekRange,
  formatWeekdayName,
  getNextDayInTerm,
  getNextWeek,
  getPreviousDayInTerm,
  getPreviousWeek,
  getWeekStart,
  getYearAndWeekNumber,
  weekOverlapsTerm,
} from "@/lib/timetable/utils";
import { toIntlLocale } from "@/lib/languages";
import type { Id } from "../../../convex/_generated/dataModel";

const timetableRouteApi = getRouteApi("/_authenticated/_class/class/$classId/timetable/");

type TimetablePageProps = {
  classId: Id<"classes">;
};

export function TimetablePage({ classId }: TimetablePageProps) {
  const { t, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const navigate = timetableRouteApi.useNavigate();
  const search = timetableRouteApi.useSearch();
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("timetable:manage");

  const { view, currentDate, weekStart: searchWeekStart } = parseTimetableSearch(search);

  const {
    data: terms,
    isPending: termsPending,
    isError: termsError,
    refetch: refetchTerms,
  } = useTimetableTerms(classId);

  const [selectedTermId, setSelectedTermId] = useState<Id<"timetableTerms"> | undefined>();
  const [termFormOpen, setTermFormOpen] = useState(false);
  const [termEditOpen, setTermEditOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<TimetableSubject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<TimetableSubject | null>(null);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [linkingSlot, setLinkingSlot] = useState<TimetableSlot | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<TimetableSlot | null>(null);
  const [activeLesson, setActiveLesson] = useState<TimetableLesson | null>(null);
  const [lessonSheetOpen, setLessonSheetOpen] = useState(false);

  const selectedTerm = useMemo(
    () => terms?.find((term: TimetableTerm) => term._id === selectedTermId) ?? terms?.[0],
    [terms, selectedTermId],
  );

  useEffect(() => {
    if (terms?.length && !selectedTermId) {
      setSelectedTermId(terms[0]?._id);
    }
  }, [terms, selectedTermId]);

  const weekStart = useMemo(() => {
    if (!selectedTerm) return searchWeekStart;
    return clampWeekStartToTerm(
      searchWeekStart,
      selectedTerm.startDateKey,
      selectedTerm.endDateKey,
    );
  }, [searchWeekStart, selectedTerm]);

  const focusedDate = useMemo(() => {
    if (!selectedTerm) return currentDate;
    return clampDateToTerm(currentDate, selectedTerm.startDateKey, selectedTerm.endDateKey);
  }, [currentDate, selectedTerm]);

  const updateSearch = useCallback(
    (updates: { view?: TimetableViewMode; date?: Date }) => {
      void navigate({
        search: (prev) => ({
          view: updates.view ?? prev.view ?? "week",
          date: updates.date !== undefined ? toDateSearchParam(updates.date) : prev.date,
        }),
      });
    },
    [navigate],
  );

  const { year, weekNumber } = getYearAndWeekNumber(view === "day" ? focusedDate : weekStart);

  const {
    data: bundle,
    isPending: bundlePending,
    isError: bundleError,
    refetch: refetchBundle,
  } = useTimetableWeekBundle(classId, selectedTerm?._id, year, weekNumber);

  const addLesson = useAddLessonToSlot();
  const removeLesson = useRemoveLesson();
  const toggleDisable = useToggleSlotDisabledForWeek();
  const removeSubject = useRemoveTimetableSubject();
  const removeSlot = useRemoveTimetableSlot();
  const unlinkSlot = useUnlinkSlot();

  const days = selectedTerm?.days ?? [];

  const dateLabel =
    view === "week" ? formatWeekRange(weekStart, locale) : formatDayDate(focusedDate, locale);

  const canGoPrevious =
    selectedTerm &&
    (view === "week"
      ? weekOverlapsTerm(
          getPreviousWeek(weekStart),
          selectedTerm.startDateKey,
          selectedTerm.endDateKey,
        )
      : getPreviousDayInTerm(focusedDate, selectedTerm.startDateKey) !== null);

  const canGoNext =
    selectedTerm &&
    (view === "week"
      ? weekOverlapsTerm(getNextWeek(weekStart), selectedTerm.startDateKey, selectedTerm.endDateKey)
      : getNextDayInTerm(focusedDate, selectedTerm.endDateKey) !== null);

  const actionItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "new-term",
        label: t("createTerm"),
        icon: <Plus />,
        permission: "timetable:manage",
        group: "create",
        onSelect: () => setTermFormOpen(true),
      },
      {
        id: "edit-term",
        label: t("editTerm"),
        icon: <Pencil />,
        permission: "timetable:manage",
        group: "manage",
        onSelect: () => setTermEditOpen(true),
      },
      {
        id: "new-subject",
        label: t("createSubject"),
        icon: <Plus />,
        permission: "timetable:manage",
        group: "create",
        onSelect: () => {
          setEditingSubject(null);
          setSubjectFormOpen(true);
        },
      },
      {
        id: "new-slot",
        label: t("createSlot"),
        icon: <Plus />,
        permission: "timetable:manage",
        group: "create",
        onSelect: () => {
          setEditingSlot(null);
          setSlotFormOpen(true);
        },
      },
    ],
    [t],
  );

  const handlePrevious = () => {
    if (!selectedTerm) return;
    if (view === "week") {
      updateSearch({ date: getPreviousWeek(weekStart) });
      return;
    }
    const prev = getPreviousDayInTerm(focusedDate, selectedTerm.startDateKey);
    if (prev) updateSearch({ date: prev });
  };

  const handleNext = () => {
    if (!selectedTerm) return;
    if (view === "week") {
      updateSearch({ date: getNextWeek(weekStart) });
      return;
    }
    const next = getNextDayInTerm(focusedDate, selectedTerm.endDateKey);
    if (next) updateSearch({ date: next });
  };

  const handleGoToCurrent = () => {
    const now = new Date();
    updateSearch({
      date: view === "week" ? getWeekStart(now) : now,
    });
  };

  const handleViewChange = (nextView: TimetableViewMode) => {
    if (nextView === "day") {
      updateSearch({ view: nextView, date: new Date() });
      return;
    }
    updateSearch({ view: nextView, date: weekStart });
  };

  if (termsPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (termsError) {
    return (
      <div className="px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
        <ErrorState title={t("loadFailed")} onRetry={() => void refetchTerms()} />
      </div>
    );
  }

  if (!terms?.length) {
    return (
      <div className="px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTermsTitle")}</EmptyTitle>
            <EmptyDescription>
              {canManage ? t("emptyTermsDescriptionManage") : t("emptyTermsDescriptionView")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <Button onClick={() => setTermFormOpen(true)}>
              <Plus data-icon="inline-start" />
              {t("createTerm")}
            </Button>
          ) : null}
        </Empty>
        <TimetableTermFormCredenza
          open={termFormOpen}
          onOpenChange={setTermFormOpen}
          classId={classId}
          existingTerms={[]}
          onCreated={setSelectedTermId}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedTerm?._id}
            onValueChange={(value) => setSelectedTermId(value as Id<"timetableTerms">)}
          >
            <SelectTrigger className="w-fit max-w-[14rem]">
              <SelectValue placeholder={t("selectTerm")}>
                {selectedTerm?.name ?? t("selectTerm")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {terms.map((term: TimetableTerm) => (
                <SelectItem key={term._id} value={term._id}>
                  {term.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!canGoPrevious}
            onClick={handlePrevious}
            aria-label={view === "week" ? t("previousWeek") : t("previousDay")}
          >
            <ChevronLeft />
          </Button>
          <span className="text-center text-sm font-medium whitespace-nowrap">{dateLabel}</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!canGoNext}
            onClick={handleNext}
            aria-label={view === "week" ? t("nextWeek") : t("nextDay")}
          >
            <ChevronRight />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleGoToCurrent}>
            {view === "week" ? t("thisWeek") : t("today")}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(value) => {
              if (value === "week" || value === "day") handleViewChange(value);
            }}
          >
            <TabsList>
              <TabsTrigger value="week">{t("viewWeek")}</TabsTrigger>
              <TabsTrigger value="day">{t("viewDay")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <TimetableSubjectsSidebarToggle />
          <ActionMenu items={actionItems} label={t("actions")} />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 gap-3">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border">
          {bundlePending ? <Skeleton className="h-[480px] w-full" /> : null}
          {bundleError ? (
            <ErrorState title={t("loadFailed")} onRetry={() => void refetchBundle()} />
          ) : null}
          {bundle && selectedTerm ? (
            <TimetableTimelineGrid
              bundle={bundle}
              days={days}
              weekStart={weekStart}
              locale={locale}
              view={view}
              currentDate={focusedDate}
              canManage={canManage}
              onAddSubject={(slotId, subjectId) =>
                void addLesson.mutateAsync({
                  classId,
                  termId: selectedTerm._id,
                  slotId,
                  subjectId,
                  year,
                  weekNumber,
                })
              }
              onLessonClick={(lesson) => {
                setActiveLesson(lesson);
                setLessonSheetOpen(true);
              }}
              onRemoveLesson={(lessonId) =>
                void removeLesson.mutateAsync({
                  classId,
                  termId: selectedTerm._id,
                  year,
                  weekNumber,
                  lessonId,
                })
              }
              onEditSlot={(slot) => {
                setEditingSlot(slot);
                setSlotFormOpen(true);
              }}
              onDeleteSlot={setDeletingSlot}
              onLinkSlot={setLinkingSlot}
              onUnlinkSlot={(slot) =>
                void unlinkSlot.mutateAsync({
                  classId,
                  termId: selectedTerm._id,
                  year,
                  weekNumber,
                  slotId: slot._id,
                })
              }
              onToggleWeekDisable={(slotId, disabled) =>
                void toggleDisable.mutateAsync({
                  classId,
                  termId: selectedTerm._id,
                  year,
                  weekNumber,
                  slotId,
                  disabled,
                })
              }
            />
          ) : null}
        </div>

        {bundle ? (
          <TimetableSubjectsSidebarPanel
            bundle={bundle}
            canManage={canManage}
            onCreateSubject={() => {
              setEditingSubject(null);
              setSubjectFormOpen(true);
            }}
            onEditSubject={(subject) => {
              setEditingSubject(subject);
              setSubjectFormOpen(true);
            }}
            onDeleteSubject={setDeletingSubject}
          />
        ) : null}
      </div>

      <TimetableTermFormCredenza
        open={termFormOpen}
        onOpenChange={setTermFormOpen}
        classId={classId}
        existingTerms={terms}
        onCreated={setSelectedTermId}
      />

      {selectedTerm ? (
        <>
          <TimetableTermFormCredenza
            open={termEditOpen}
            onOpenChange={setTermEditOpen}
            classId={classId}
            existingTerms={terms}
            term={selectedTerm}
            year={year}
            weekNumber={weekNumber}
          />
          <TimetableSubjectFormCredenza
            open={subjectFormOpen}
            onOpenChange={setSubjectFormOpen}
            classId={classId}
            termId={selectedTerm._id}
            year={year}
            weekNumber={weekNumber}
            subject={editingSubject}
          />
          <DeleteNamedCredenza
            open={deletingSubject !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingSubject(null);
            }}
            title={t("deleteSubjectTitle", { name: deletingSubject?.name ?? "" })}
            description={t("deleteSubjectDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              if (!deletingSubject) return;
              await removeSubject.mutateAsync({
                classId,
                termId: selectedTerm._id,
                year,
                weekNumber,
                subjectId: deletingSubject._id,
              });
              setDeletingSubject(null);
            }}
          />
          <TimetableSlotFormCredenza
            open={slotFormOpen}
            onOpenChange={setSlotFormOpen}
            classId={classId}
            term={selectedTerm}
            year={year}
            weekNumber={weekNumber}
            slot={editingSlot}
          />
          {linkingSlot ? (
            <TimetableLinkSlotsCredenza
              open={linkingSlot !== null}
              onOpenChange={(open) => {
                if (!open) setLinkingSlot(null);
              }}
              classId={classId}
              term={selectedTerm}
              sourceSlot={linkingSlot}
              allSlots={bundle?.slots ?? []}
              year={year}
              weekNumber={weekNumber}
            />
          ) : null}
          <DeleteNamedCredenza
            open={deletingSlot !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingSlot(null);
            }}
            title={t("deleteSlotTitle", {
              day: deletingSlot ? formatWeekdayName(deletingSlot.day, locale) : "",
              start: deletingSlot?.startTime ?? "",
              end: deletingSlot?.endTime ?? "",
            })}
            description={t("deleteSlotDescription")}
            confirmLabel={t("deleteAction")}
            onConfirm={async () => {
              if (!deletingSlot) return;
              await removeSlot.mutateAsync({
                classId,
                termId: selectedTerm._id,
                year,
                weekNumber,
                slotId: deletingSlot._id,
              });
              setDeletingSlot(null);
            }}
          />
          <TimetableLessonSheet
            open={lessonSheetOpen}
            onOpenChange={setLessonSheetOpen}
            classId={classId}
            termId={selectedTerm._id}
            year={year}
            weekNumber={weekNumber}
            lesson={activeLesson}
            canManage={canManage}
          />
        </>
      ) : null}
    </div>
  );
}
