import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMoveLesson } from "@/hooks/timetable/useTimetableMutations";
import { toIntlLocale } from "@/lib/languages";
import type { TimetableLesson, TimetableSlot, TimetableTerm } from "@/lib/timetable/timetable";
import { formatTimeString, formatWeekdayName, timeToMinutes } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableMoveLessonCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  term: TimetableTerm;
  lesson: TimetableLesson;
  allSlots: Array<TimetableSlot>;
  allLessons: Array<TimetableLesson>;
  year: number;
  weekNumber: number;
  timeFormat?: "12" | "24";
};

export function TimetableMoveLessonCredenza({
  open,
  onOpenChange,
  classId,
  term,
  lesson,
  allSlots,
  allLessons,
  year,
  weekNumber,
  timeFormat = "24",
}: TimetableMoveLessonCredenzaProps) {
  const { t, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const moveLesson = useMoveLesson();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<Id<"timetableSlots"> | null>(null);

  const occupiedSlotIds = useMemo(() => {
    const occupied = new Set<Id<"timetableSlots">>();
    for (const row of allLessons) {
      if (row.subjectId === lesson.subjectId && row._id !== lesson._id) {
        occupied.add(row.slotId);
      }
    }
    return occupied;
  }, [allLessons, lesson._id, lesson.subjectId]);

  const groupedSlots = useMemo(() => {
    const byDay = new Map<string, Array<TimetableSlot>>();
    for (const day of term.days) {
      byDay.set(day, []);
    }
    for (const slot of allSlots) {
      if (slot._id === lesson.slotId) continue;
      const daySlots = byDay.get(slot.day) ?? [];
      daySlots.push(slot);
      byDay.set(slot.day, daySlots);
    }
    for (const daySlots of byDay.values()) {
      daySlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }
    return term.days
      .map((day) => ({ day, slots: byDay.get(day) ?? [] }))
      .filter((group) => group.slots.length > 0);
  }, [allSlots, lesson.slotId, term.days]);

  const handleSubmit = async () => {
    if (!selectedSlotId) return;
    if (occupiedSlotIds.has(selectedSlotId)) {
      setSubmitError(t("moveLessonOccupied"));
      return;
    }
    setSubmitError(null);
    onOpenChange(false);
    try {
      await moveLesson.mutateAsync({
        classId,
        termId: term._id,
        year,
        weekNumber,
        lessonId: lesson._id,
        targetSlotId: selectedSlotId,
      });
    } catch (error) {
      onOpenChange(true);
      setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
    }
  };

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelectedSlotId(null);
          setSubmitError(null);
        }
        onOpenChange(next);
      }}
    >
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("moveLessonTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {t("moveLessonDescription", { name: lesson.subject.name })}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <ScrollArea className="max-h-80 pr-3">
            <div className="space-y-4">
              {groupedSlots.map(({ day, slots }) => (
                <div key={day} className="space-y-2">
                  <div className="text-sm font-medium">{formatWeekdayName(day, locale)}</div>
                  <div className="space-y-2">
                    {slots.map((slot) => {
                      const occupied = occupiedSlotIds.has(slot._id);
                      const selected = selectedSlotId === slot._id;
                      const label = `${formatTimeString(slot.startTime, timeFormat)} – ${formatTimeString(slot.endTime, timeFormat)}`;
                      return (
                        <button
                          key={slot._id}
                          type="button"
                          disabled={occupied}
                          onClick={() => setSelectedSlotId(slot._id)}
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                            occupied
                              ? "cursor-not-allowed opacity-50"
                              : selected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          <span>{label}</span>
                          {occupied ? (
                            <span className="text-xs text-muted-foreground">
                              {t("moveLessonOccupied")}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupedSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("moveLessonEmpty")}</p>
              ) : null}
            </div>
          </ScrollArea>
          {submitError ? <p className="mt-3 text-sm text-destructive">{submitError}</p> : null}
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            disabled={!selectedSlotId || moveLesson.isPending}
            onClick={() => void handleSubmit()}
          >
            {t("moveLessonConfirm")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
