import { useEffect, useMemo, useRef, useState } from "react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTimetableTerm } from "@/hooks/timetable/useCreateTimetableTerm";
import { useUpdateTimetableTerm } from "@/hooks/timetable/useTimetableMutations";
import {
  createClientTimetableTermFormSchema,
  type TimetableTermFormValues,
} from "@/lib/timetable/timetableFormSchema";
import { type TimetableTerm, type TimetableTermKind } from "@/lib/timetable/timetable";
import { WEEKDAY_NAMES } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableTermFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  existingTerms: Array<TimetableTerm>;
  term?: TimetableTerm;
  year?: number;
  weekNumber?: number;
  onCreated?: (termId: Id<"timetableTerms">) => void;
};

const KINDS: Array<TimetableTermKind> = ["quarter", "semester", "trimester", "year", "custom"];

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

function defaultCreateValues(): TimetableTermFormValues {
  return {
    name: "",
    kind: "semester",
    startDateKey: "",
    endDateKey: "",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    startTime: "08:00",
    endTime: "15:00",
    copyFromTermId: "",
  };
}

function valuesFromTerm(term: TimetableTerm): TimetableTermFormValues {
  return {
    name: term.name,
    kind: term.kind,
    startDateKey: term.startDateKey,
    endDateKey: term.endDateKey,
    days: [...term.days],
    startTime: term.startTime,
    endTime: term.endTime,
    copyFromTermId: "",
  };
}

export function TimetableTermFormCredenza({
  open,
  onOpenChange,
  classId,
  existingTerms,
  term,
  year,
  weekNumber,
  onCreated,
}: TimetableTermFormCredenzaProps) {
  const { t } = useTranslation("timetable");
  const createTerm = useCreateTimetableTerm();
  const updateTerm = useUpdateTimetableTerm();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const mode = term ? "edit" : "create";

  const defaults = useMemo(() => (term ? valuesFromTerm(term) : defaultCreateValues()), [term]);

  const schema = useMemo(() => createClientTimetableTermFormSchema(t), [t]);

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message ?? t("saveFailed");
        const path = issue?.path[0];
        if (typeof path === "string") {
          form.setFieldMeta(path as keyof TimetableTermFormValues, (prev) => ({
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
        if (mode === "edit" && term) {
          await updateTerm.mutateAsync({
            classId,
            termId: term._id,
            year: year ?? 0,
            weekNumber: weekNumber ?? 0,
            name: parsed.data.name,
            kind: parsed.data.kind,
            startDateKey: parsed.data.startDateKey,
            endDateKey: parsed.data.endDateKey,
            days: parsed.data.days,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
          });
        } else {
          const termId = await createTerm.mutateAsync({
            classId,
            name: parsed.data.name,
            kind: parsed.data.kind,
            startDateKey: parsed.data.startDateKey,
            endDateKey: parsed.data.endDateKey,
            days: parsed.data.days,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
            copySlotsFromTermId: parsed.data.copyFromTermId
              ? (parsed.data.copyFromTermId as Id<"timetableTerms">)
              : undefined,
          });
          onCreated?.(termId);
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

  const pending = createTerm.isPending || updateTerm.isPending;
  const title = mode === "edit" ? t("editTermTitle") : t("createTermTitle");
  const description = mode === "edit" ? t("editTermDescription") : t("createTermDescription");

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{description}</CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-4">
            <form.Field name="name">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                  <FieldLabel htmlFor="term-name">{t("termName")}</FieldLabel>
                  <Input
                    id="term-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length ? true : undefined}
                  />
                  <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="kind">
              {(field) => (
                <Field>
                  <FieldLabel>{t("termKind")}</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as TimetableTermKind)}
                  >
                    <SelectTrigger>
                      <SelectValue>{t(`termKind_${field.state.value}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`termKind_${k}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="startDateKey">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="term-start">{t("startDate")}</FieldLabel>
                    <Input
                      id="term-start"
                      type="date"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
              <form.Field name="endDateKey">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="term-end">{t("endDate")}</FieldLabel>
                    <Input
                      id="term-end"
                      type="date"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="startTime">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="term-start-time">{t("dayStart")}</FieldLabel>
                    <Input
                      id="term-start-time"
                      type="time"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
              <form.Field name="endTime">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                    <FieldLabel htmlFor="term-end-time">{t("dayEnd")}</FieldLabel>
                    <Input
                      id="term-end-time"
                      type="time"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                )}
              </form.Field>
            </div>

            <form.Field name="days">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                  <FieldLabel>{t("meetingDays")}</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {WEEKDAY_NAMES.map((day) => (
                      <label key={day} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.state.value.includes(day)}
                          onCheckedChange={() => {
                            const next = field.state.value.includes(day)
                              ? field.state.value.filter((d) => d !== day)
                              : [...field.state.value, day];
                            field.handleChange(next);
                          }}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                  <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            {mode === "create" && existingTerms.length > 0 ? (
              <form.Field name="copyFromTermId">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("copySlotsFrom")}</FieldLabel>
                    <Select
                      value={field.state.value || "__none__"}
                      onValueChange={(v) => field.handleChange(v === "__none__" ? "" : (v ?? ""))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("copySlotsNone")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("copySlotsNone")}</SelectItem>
                        {existingTerms.map((existing) => (
                          <SelectItem key={existing._id} value={existing._id}>
                            {existing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            ) : null}

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
