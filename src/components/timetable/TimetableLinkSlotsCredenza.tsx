import { useEffect, useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useSyncSlotLinks } from "@/hooks/timetable/useTimetableMutations";
import { createClientTimetableLinkSlotsFormSchema } from "@/lib/timetable/timetableFormSchema";
import type { TimetableSlot, TimetableTerm } from "@/lib/timetable/timetable";
import { toIntlLocale } from "@/lib/languages";
import { formatTimeString, formatWeekdayName, timeToMinutes } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableLinkSlotsCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  term: TimetableTerm;
  sourceSlot: TimetableSlot;
  allSlots: Array<TimetableSlot>;
  year: number;
  weekNumber: number;
  timeFormat?: "12" | "24";
};

export function TimetableLinkSlotsCredenza({
  open,
  onOpenChange,
  classId,
  term,
  sourceSlot,
  allSlots,
  year,
  weekNumber,
  timeFormat = "24",
}: TimetableLinkSlotsCredenzaProps) {
  const { t, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const syncLinks = useSyncSlotLinks();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = useMemo(() => createClientTimetableLinkSlotsFormSchema(), []);

  const otherSlots = useMemo(
    () => allSlots.filter((slot) => slot._id !== sourceSlot._id),
    [allSlots, sourceSlot._id],
  );

  const groupedSlots = useMemo(() => {
    const byDay = new Map<string, Array<TimetableSlot>>();
    for (const day of term.days) {
      byDay.set(day, []);
    }
    for (const slot of otherSlots) {
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
  }, [otherSlots, term.days]);

  const defaultSelected = useMemo(() => {
    if (!sourceSlot.linkGroupId) return [];
    return otherSlots
      .filter((slot) => slot.linkGroupId === sourceSlot.linkGroupId)
      .map((slot) => slot._id);
  }, [otherSlots, sourceSlot.linkGroupId]);

  const form = useForm({
    defaultValues: { selectedSlotIds: defaultSelected },
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? t("saveFailed"));
        return;
      }

      setSubmitError(null);
      onOpenChange(false);
      try {
        await syncLinks.mutateAsync({
          classId,
          termId: term._id,
          sourceSlotId: sourceSlot._id,
          selectedSlotIds: parsed.data.selectedSlotIds as Array<Id<"timetableSlots">>,
          year,
          weekNumber,
        });
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ selectedSlotIds: defaultSelected });
    setSubmitError(null);
  }, [open, defaultSelected, form]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("linkSlotsTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {t("linkSlotsDescription", {
              day: formatWeekdayName(sourceSlot.day, locale),
              start: formatTimeString(sourceSlot.startTime, timeFormat),
              end: formatTimeString(sourceSlot.endTime, timeFormat),
            })}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody>
            <ScrollArea className="max-h-80 pr-3">
              <div className="space-y-4">
                {groupedSlots.map(({ day, slots }) => (
                  <div key={day} className="space-y-2">
                    <div className="text-sm font-medium">{formatWeekdayName(day, locale)}</div>
                    <div className="space-y-2">
                      {slots.map((slot) => (
                        <form.Field key={slot._id} name="selectedSlotIds">
                          {(field) => {
                            const checked = field.state.value.includes(slot._id);
                            const label = `${formatTimeString(slot.startTime, timeFormat)} – ${formatTimeString(slot.endTime, timeFormat)}`;
                            return (
                              <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const next =
                                      value === true
                                        ? [...field.state.value, slot._id]
                                        : field.state.value.filter((id) => id !== slot._id);
                                    field.handleChange(next);
                                  }}
                                />
                                <span className="text-sm">{label}</span>
                              </label>
                            );
                          }}
                        </form.Field>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("linkSlotsEmpty")}</p>
                ) : null}
              </div>
            </ScrollArea>
            {submitError ? <p className="mt-3 text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit" disabled={syncLinks.isPending}>
              {t("saveLinksAction")}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
