import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useForm } from "@tanstack/react-form";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTimetableSlot,
  useUpdateTimetableSlot,
} from "@/hooks/timetable/useTimetableMutations";
import {
  createClientTimetableSlotFormSchema,
  type TimetableSlotFormValues,
} from "@/lib/timetable/timetableFormSchema";
import { toIntlLocale } from "@/lib/languages";
import type { TimetableSlot, TimetableTerm } from "@/lib/timetable/timetable";
import { formatWeekdayName } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableSlotFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  term: TimetableTerm;
  year: number;
  weekNumber: number;
  slot?: TimetableSlot | null;
};

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function defaultCreateValues(term: TimetableTerm): TimetableSlotFormValues {
  return {
    day: term.days[0] ?? "Monday",
    startTime: term.startTime,
    endTime: term.endTime,
    disabled: false,
  };
}

function valuesFromSlot(slot: TimetableSlot): TimetableSlotFormValues {
  return {
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    disabled: slot.disabled,
  };
}

export function TimetableSlotFormCredenza({
  open,
  onOpenChange,
  classId,
  term,
  year,
  weekNumber,
  slot,
}: TimetableSlotFormCredenzaProps) {
  const { t, i18n } = useTranslation("timetable");
  const locale = toIntlLocale(i18n.language);
  const createSlot = useCreateTimetableSlot();
  const updateSlot = useUpdateTimetableSlot();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const mode = slot ? "edit" : "create";

  const defaults = useMemo(
    () => (slot ? valuesFromSlot(slot) : defaultCreateValues(term)),
    [slot, term],
  );

  const schema = useMemo(() => createClientTimetableSlotFormSchema(t), [t]);

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message ?? t("saveFailed");
        const path = issue?.path[0];
        if (typeof path === "string") {
          form.setFieldMeta(path as keyof TimetableSlotFormValues, (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onSubmit: message },
            errors: [message],
          }));
        } else {
          setSubmitError(message);
        }
        return;
      }

      setSubmitError(null);
      onOpenChange(false);
      try {
        if (mode === "edit" && slot) {
          await updateSlot.mutateAsync({
            classId,
            termId: term._id,
            year,
            weekNumber,
            slotId: slot._id,
            day: parsed.data.day,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
            disabled: parsed.data.disabled ?? false,
          });
        } else {
          await createSlot.mutateAsync({
            classId,
            termId: term._id,
            year,
            weekNumber,
            day: parsed.data.day,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
          });
        }
      } catch (error) {
        skipNextResetRef.current = true;
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    form.reset(defaults);
    setSubmitError(null);
  }, [open, defaults, form]);

  const pending = createSlot.isPending || updateSlot.isPending;

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void form.handleSubmit();
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{slot ? t("editSlotTitle") : t("createSlotTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("slotFormDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-4">
            <form.Field name="day">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                  <FieldLabel>{t("slotDay")}</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => v && field.handleChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {term.days.map((d: string) => (
                        <SelectItem key={d} value={d}>
                          {formatWeekdayName(d, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="startTime">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="slot-start">{t("startTime")}</FieldLabel>
                    <Input
                      id="slot-start"
                      type="time"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={submitOnEnter}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
              <form.Field name="endTime">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="slot-end">{t("endTime")}</FieldLabel>
                    <Input
                      id="slot-end"
                      type="time"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onKeyDown={submitOnEnter}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
            </div>

            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit" disabled={pending}>
              {t("saveAction")}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
