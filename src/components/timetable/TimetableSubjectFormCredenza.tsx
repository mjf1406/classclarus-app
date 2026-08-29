import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TimetableSectionListEditor } from "@/components/timetable/TimetableSectionListEditor";
import {
  useCreateTimetableSubject,
  useUpdateTimetableSubject,
} from "@/hooks/timetable/useTimetableMutations";
import { useTimetableTags } from "@/hooks/timetable/useTimetableQueries";
import { CALENDAR_AUDIENCE_ROLES } from "../../../convex/lib/calendar/audience";
import type { TimetableSubject } from "@/lib/timetable/timetable";
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

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
} as const;

function defaultCreateValues(): TimetableSubjectFormValues {
  return {
    name: "",
    bgColor: "#6366f1",
    textColor: "#ffffff",
    iconName: "",
    defaultMaterials: [],
    defaultAnnouncements: [],
    defaultAgenda: [],
    calendarAudienceRoles: ["student"],
  };
}

function valuesFromSubject(subject: TimetableSubject): TimetableSubjectFormValues {
  return {
    name: subject.name,
    bgColor: subject.bgColor,
    textColor: subject.textColor,
    iconName: subject.iconName ?? "",
    defaultMaterials: subject.defaultMaterials,
    defaultAnnouncements: subject.defaultAnnouncements,
    defaultAgenda: subject.defaultAgenda,
    calendarAudienceRoles: subject.calendarAudienceRoles,
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
  const { t: tClasses } = useTranslation("classes");
  const createSubject = useCreateTimetableSubject();
  const updateSubject = useUpdateTimetableSubject();
  const { data: tags } = useTimetableTags(classId);
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
            defaultMaterials: parsed.data.defaultMaterials,
            defaultAnnouncements: parsed.data.defaultAnnouncements,
            defaultAgenda: parsed.data.defaultAgenda,
            calendarAudienceRoles: parsed.data.calendarAudienceRoles,
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
            defaultMaterials: parsed.data.defaultMaterials,
            defaultAnnouncements: parsed.data.defaultAnnouncements,
            defaultAgenda: parsed.data.defaultAgenda,
            calendarAudienceRoles: parsed.data.calendarAudienceRoles,
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
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    void form.handleSubmit();
  };

  const submitOnModEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey) || pending) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
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
          onKeyDown={submitOnModEnter}
        >
          <CredenzaBody className="flex flex-col gap-4">
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

            <form.Field name="calendarAudienceRoles">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel>{t("calendarAudience")}</FieldLabel>
                    <FieldDescription>{t("calendarAudienceDescription")}</FieldDescription>
                    <div className="flex flex-col gap-2">
                      {CALENDAR_AUDIENCE_ROLES.map((role) => {
                        const checked = field.state.value.includes(role);
                        return (
                          <label key={role} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                field.handleChange(
                                  next === true
                                    ? [...field.state.value, role]
                                    : field.state.value.filter((item) => item !== role),
                                );
                              }}
                            />
                            {tClasses(ROLE_LABEL_KEYS[role])}
                          </label>
                        );
                      })}
                    </div>
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="defaultMaterials">
              {(field) => (
                <Field>
                  <FieldLabel>{t("materialsSection")}</FieldLabel>
                  <FieldDescription>{t("defaultMaterialsDescription")}</FieldDescription>
                  <TimetableSectionListEditor
                    items={field.state.value}
                    onChange={(next) => field.handleChange(next)}
                    tags={tags ?? []}
                    placeholder={t("materialsPlaceholder")}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="defaultAnnouncements">
              {(field) => (
                <Field>
                  <FieldLabel>{t("announcementsSection")}</FieldLabel>
                  <FieldDescription>{t("defaultAnnouncementsDescription")}</FieldDescription>
                  <TimetableSectionListEditor
                    items={field.state.value}
                    onChange={(next) => field.handleChange(next)}
                    tags={tags ?? []}
                    placeholder={t("announcementsPlaceholder")}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="defaultAgenda">
              {(field) => (
                <Field>
                  <FieldLabel>{t("agendaSection")}</FieldLabel>
                  <FieldDescription>{t("defaultAgendaDescription")}</FieldDescription>
                  <TimetableSectionListEditor
                    items={field.state.value}
                    onChange={(next) => field.handleChange(next)}
                    tags={tags ?? []}
                    placeholder={t("agendaPlaceholder")}
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
