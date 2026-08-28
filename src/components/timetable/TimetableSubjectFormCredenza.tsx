import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
import { AssignmentInstructionsEditor } from "@/components/assignments/AssignmentInstructionsEditor";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useCreateTimetableSubject,
  useUpdateTimetableSubject,
} from "@/hooks/timetable/useTimetableMutations";
import type { TimetableSubject } from "@/lib/timetable/timetable";
import { EMPTY_NOTES_JSON } from "@/lib/timetable/timetable";
import {
  createClientTimetableSubjectFormSchema,
  type TimetableSubjectFormValues,
} from "@/lib/timetable/timetableFormSchema";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableSubjectFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
  subject?: TimetableSubject | null;
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

function defaultCreateValues(): TimetableSubjectFormValues {
  return {
    name: "",
    bgColor: "#6366f1",
    textColor: "#ffffff",
    iconName: "",
    defaultNotesJson: EMPTY_NOTES_JSON,
  };
}

function valuesFromSubject(subject: TimetableSubject): TimetableSubjectFormValues {
  return {
    name: subject.name,
    bgColor: subject.bgColor,
    textColor: subject.textColor,
    iconName: subject.iconName ?? "",
    defaultNotesJson: subject.defaultNotesJson ?? EMPTY_NOTES_JSON,
  };
}

export function TimetableSubjectFormCredenza({
  open,
  onOpenChange,
  classId,
  termId,
  year,
  weekNumber,
  subject,
}: TimetableSubjectFormCredenzaProps) {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const createSubject = useCreateTimetableSubject();
  const updateSubject = useUpdateTimetableSubject();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const skipNextResetRef = useRef(false);
  const mode = subject ? "edit" : "create";

  const defaults = useMemo(
    () => (subject ? valuesFromSubject(subject) : defaultCreateValues()),
    [subject],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(() => createClientTimetableSubjectFormSchema(t), [t]);

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message ?? t("saveFailed");
        const path = issue?.path[0];
        if (typeof path === "string") {
          form.setFieldMeta(path as keyof TimetableSubjectFormValues, (prev) => ({
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
      const iconName = parsed.data.iconName?.trim() || undefined;
      try {
        if (mode === "edit" && subject) {
          await updateSubject.mutateAsync({
            classId,
            termId,
            year,
            weekNumber,
            subjectId: subject._id,
            name: parsed.data.name,
            bgColor: parsed.data.bgColor,
            textColor: parsed.data.textColor,
            iconName,
            defaultNotesJson: parsed.data.defaultNotesJson,
          });
        } else {
          await createSubject.mutateAsync({
            classId,
            termId,
            year,
            weekNumber,
            name: parsed.data.name,
            bgColor: parsed.data.bgColor,
            textColor: parsed.data.textColor,
            iconName,
            defaultNotesJson: parsed.data.defaultNotesJson,
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
    form.reset(defaultsRef.current);
    setSubmitError(null);
    const icon = defaultsRef.current.iconName;
    if (icon) {
      void resolveIconId(icon).then((resolved) => setFaIcon(resolved));
    } else {
      setFaIcon(null);
    }
  }, [open, defaults, form]);

  const pending = createSubject.isPending || updateSubject.isPending;

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
          <CredenzaTitle>{subject ? t("editSubjectTitle") : t("createSubjectTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {subject ? t("editSubjectDescription") : t("createSubjectDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-4">
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

            <form.Field name="name">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="subject-name">{t("subjectName")}</FieldLabel>
                    <Input
                      id="subject-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onKeyDown={submitOnEnter}
                      aria-invalid={error ? true : undefined}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <div className="grid grid-cols-2 gap-3">
              <form.Field name="bgColor">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="subject-bg">{t("backgroundColor")}</FieldLabel>
                      <Input
                        id="subject-bg"
                        type="color"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="textColor">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="subject-text">{t("textColor")}</FieldLabel>
                      <Input
                        id="subject-text"
                        type="color"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>
            </div>

            <form.Field name="iconName">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel>
                      {t("subjectIcon")}
                      <span className="font-normal text-muted-foreground">
                        ({tCommon("optional")})
                      </span>
                    </FieldLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <FontAwesomeIconPickerLazy
                        value={faIcon}
                        onChange={(icon) => {
                          setFaIcon(icon);
                          field.handleChange(iconDefinitionToId(icon));
                        }}
                        className="w-full max-w-[280px]"
                      />
                      {field.state.value ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFaIcon(null);
                            field.handleChange("");
                          }}
                        >
                          {t("clearIcon")}
                        </Button>
                      ) : null}
                    </div>
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="defaultNotesJson">
              {(field) => (
                <Field>
                  <FieldLabel>{t("defaultNotes")}</FieldLabel>
                  <FieldDescription>{t("defaultNotesDescription")}</FieldDescription>
                  <AssignmentInstructionsEditor
                    value={field.state.value ?? EMPTY_NOTES_JSON}
                    onChange={(next) => field.handleChange(next)}
                    onSubmit={() => void form.handleSubmit()}
                    placeholder={t("defaultNotesPlaceholder")}
                    className="min-h-40"
                  />
                </Field>
              )}
            </form.Field>
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
