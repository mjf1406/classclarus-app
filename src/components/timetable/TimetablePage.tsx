import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { TimetableLessonSheet } from "@/components/timetable/TimetableLessonSheet";
import { TimetableSlotFormCredenza } from "@/components/timetable/TimetableSlotFormCredenza";
import { TimetableSubjectFormCredenza } from "@/components/timetable/TimetableSubjectFormCredenza";
import { TimetableTermFormCredenza } from "@/components/timetable/TimetableTermFormCredenza";
import { TimetableWeekGrid } from "@/components/timetable/TimetableWeekGrid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useAddLessonToSlot,
  useRemoveLesson,
  useToggleSlotDisabledForWeek,
} from "@/hooks/timetable/useTimetableMutations";
import { useTimetableTerms, useTimetableWeekBundle } from "@/hooks/timetable/useTimetableQueries";
import { useCan } from "@/hooks/permissions/useCan";
import type { TimetableLesson, TimetableSlot, TimetableTerm } from "@/lib/timetable/timetable";
import {
  clampWeekStartToTerm,
  formatWeekRange,
  getNextWeek,
  getPreviousWeek,
  getWeekStart,
  getYearAndWeekNumber,
  weekOverlapsTerm,
} from "@/lib/timetable/utils";
import { toIntlLocale } from "@/lib/languages";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetablePageProps = {
  classId: Id<"classes">;
};

export function TimetablePage({ classId }: TimetablePageProps) {
  const { t, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("timetable:manage");

  const {
    data: terms,
    isPending: termsPending,
    isError: termsError,
    refetch: refetchTerms,
  } = useTimetableTerms(classId);

  const [selectedTermId, setSelectedTermId] = useState<Id<"timetableTerms"> | undefined>();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [termFormOpen, setTermFormOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
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

  useEffect(() => {
    if (!selectedTerm) return;
    setWeekStart((prev) =>
      clampWeekStartToTerm(prev, selectedTerm.startDateKey, selectedTerm.endDateKey),
    );
  }, [selectedTerm]);

  const { year, weekNumber } = getYearAndWeekNumber(weekStart);

  const {
    data: bundle,
    isPending: bundlePending,
    isError: bundleError,
    refetch: refetchBundle,
  } = useTimetableWeekBundle(classId, selectedTerm?._id, year, weekNumber);

  const addLesson = useAddLessonToSlot();
  const removeLesson = useRemoveLesson();
  const toggleDisable = useToggleSlotDisabledForWeek();

  const days = selectedTerm?.days ?? [];

  if (termsPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  if (termsError) {
    return <ErrorState title={t("loadFailed")} onRetry={() => void refetchTerms()} />;
  }

  if (!terms?.length) {
    return (
      <>
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTermsTitle")}</EmptyTitle>
            <EmptyDescription>
              {canManage ? t("emptyTermsDescriptionManage") : t("emptyTermsDescriptionView")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <Button onClick={() => setTermFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
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
      </>
    );
  }

  const weekLabel = formatWeekRange(weekStart, locale);
  const canGoPrevious =
    selectedTerm &&
    weekOverlapsTerm(
      getPreviousWeek(weekStart),
      selectedTerm.startDateKey,
      selectedTerm.endDateKey,
    );
  const canGoNext =
    selectedTerm &&
    weekOverlapsTerm(getNextWeek(weekStart), selectedTerm.startDateKey, selectedTerm.endDateKey);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {canManage ? t("descriptionManage") : t("descriptionView")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedTerm?._id}
              onValueChange={(value) => setSelectedTermId(value as Id<"timetableTerms">)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("selectTerm")} />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term: TimetableTerm) => (
                  <SelectItem key={term._id} value={term._id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setTermFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("createTerm")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubjectFormOpen(true)}>
                  {t("createSubject")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingSlot(null);
                    setSlotFormOpen(true);
                  }}
                >
                  {t("createSlot")}
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canGoPrevious}
              onClick={() => setWeekStart(getPreviousWeek(weekStart))}
              aria-label={t("previousWeek")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canGoNext}
              onClick={() => setWeekStart(getNextWeek(weekStart))}
              aria-label={t("nextWeek")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(getWeekStart(new Date()))}
            >
              {t("thisWeek")}
            </Button>
          </div>

          {bundlePending ? <Skeleton className="h-[480px] w-full" /> : null}
          {bundleError ? (
            <ErrorState title={t("loadFailed")} onRetry={() => void refetchBundle()} />
          ) : null}
          {bundle && selectedTerm ? (
            <TimetableWeekGrid
              bundle={bundle}
              days={days}
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
        </CardContent>
      </Card>

      <TimetableTermFormCredenza
        open={termFormOpen}
        onOpenChange={setTermFormOpen}
        classId={classId}
        existingTerms={terms}
        onCreated={setSelectedTermId}
      />

      {selectedTerm ? (
        <>
          <TimetableSubjectFormCredenza
            open={subjectFormOpen}
            onOpenChange={setSubjectFormOpen}
            classId={classId}
            termId={selectedTerm._id}
            year={year}
            weekNumber={weekNumber}
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
