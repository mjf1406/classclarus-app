import { useForm } from "@tanstack/react-form";
import { PlusIcon, Trash2, TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AnnouncementEditor } from "@/components/announcements/AnnouncementEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageDocumentAttachmentsField } from "@/components/upload/ImageDocumentAttachmentsField";
import { useImageDocumentAttachments } from "@/components/upload/useImageDocumentAttachments";
import {
  dateKeyToLocalDate,
  defaultEventFormValues,
  endDateTimeFromStart,
  eventToFormValues,
  formatDateKeyLocalized,
  localDateToDateKey,
  type CalendarEvent,
  type CalendarEventSubmitValues,
} from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { CALENDAR_AUDIENCE_ROLES } from "../../../convex/lib/calendar/audience";
import {
  createCalendarEventFormSchema,
  MAX_CALENDAR_EVENT_ATTACHMENTS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
} from "../../../convex/lib/calendar/calendarEventSchema";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  MAX_REMINDER_AMOUNT,
  MAX_REMINDERS_PER_EVENT,
  REMINDER_UNITS,
  type ReminderUnit,
} from "../../../convex/lib/calendar/reminders";

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
} as const;

type CalendarEventFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  classId: Id<"classes">;
  classTimeZone?: string;
  todayKey: string;
  initial?: CalendarEvent | null;
  onSubmit: (values: CalendarEventSubmitValues) => Promise<void>;
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

function zodIssuesToFieldErrors(
  issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.reduce<string>((acc, segment) => {
      if (typeof segment === "number") return `${acc}[${segment}]`;
      if (typeof segment === "string") return acc ? `${acc}.${segment}` : segment;
      return acc;
    }, "");
    if (path && fields[path] === undefined) {
      fields[path] = issue.message;
    }
  }
  return fields;
}

function DatePickerField({
  id,
  value,
  onChange,
  label,
  error,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  label: string;
  error?: string;
}) {
  const { i18n } = useTranslation("calendar");
  const selected = value ? dateKeyToLocalDate(value) : undefined;
  const display = value ? formatDateKeyLocalized(value, toIntlLocale(i18n.language)) : "—";
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="w-full justify-start"
              aria-invalid={error ? true : undefined}
            />
          }
        >
          {display}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) onChange(localDateToDateKey(date));
            }}
          />
        </PopoverContent>
      </Popover>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function CalendarEventFormCredenza({
  open,
  onOpenChange,
  mode,
  classId,
  classTimeZone,
  todayKey,
  initial,
  onSubmit,
}: CalendarEventFormCredenzaProps) {
  const { t } = useTranslation("calendar");
  const { t: tClasses } = useTranslation("classes");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    fileIds: attachmentFileIds,
    items: attachmentItems,
    reset: resetAttachments,
    onUploaded,
    onRemove,
  } = useImageDocumentAttachments(MAX_CALENDAR_EVENT_ATTACHMENTS);
  const skipNextResetRef = useRef(false);
  const attachmentFileIdsRef = useRef(attachmentFileIds);
  attachmentFileIdsRef.current = attachmentFileIds;
  const endManuallyAdjustedRef = useRef(false);
  const todayKeyRef = useRef(todayKey);
  const classTimeZoneRef = useRef(classTimeZone);
  todayKeyRef.current = todayKey;
  classTimeZoneRef.current = classTimeZone;

  const schema = useMemo(
    () =>
      createCalendarEventFormSchema({
        titleRequired: t("titleRequired"),
        titleTooLong: t("titleTooLong", { max: MAX_EVENT_TITLE_LENGTH }),
        descriptionTooLong: t("descriptionTooLong", { max: MAX_EVENT_DESCRIPTION_LENGTH }),
        timezoneRequired: t("timezoneRequired"),
        timezoneInvalid: t("timezoneInvalid"),
        timezoneMissingForTimed: t("timezoneMissingForTimed"),
        dateInvalid: t("dateInvalid"),
        timeInvalid: t("timeInvalid"),
        endAfterStart: t("endAfterStart"),
        endDateAfterStart: t("endDateAfterStart"),
        audienceRolesRequired: t("audienceRolesRequired"),
        audienceRoleInvalid: t("audienceRoleInvalid"),
        reminderAmountInvalid: t("reminderAmountInvalid", { max: MAX_REMINDER_AMOUNT }),
        remindersTooMany: t("remindersTooMany", { max: MAX_REMINDERS_PER_EVENT }),
        reminderRoleSubset: t("reminderRoleSubset"),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaultEventFormValues(todayKey, !classTimeZone),
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) return undefined;
        return { fields: zodIssuesToFieldErrors(result.error.issues) };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues[0]?.message ?? t("saveFailed"));
        return;
      }
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({ ...parsed.data, attachmentFileIds: attachmentFileIdsRef.current });
        skipNextResetRef.current = false;
        endManuallyAdjustedRef.current = false;
        form.reset(defaultEventFormValues(todayKeyRef.current, !classTimeZoneRef.current));
        setSubmitError(null);
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  const syncEndFromStart = (startDateKey: string, startTime: string) => {
    if (endManuallyAdjustedRef.current) return;
    const end = endDateTimeFromStart(startDateKey, startTime);
    if (!end) return;
    form.setFieldValue("endDateKey", end.endDateKey);
    form.setFieldValue("endTime", end.endTime);
  };

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    setSubmitError(null);
    endManuallyAdjustedRef.current = mode === "edit";
    const next = initial
      ? eventToFormValues(initial, classTimeZone)
      : defaultEventFormValues(todayKey, !classTimeZone);
    form.reset(next);
    resetAttachments(initial ?? null);
  }, [open, form, initial, classTimeZone, todayKey, mode, resetAttachments]);

  const timedBlocked = !classTimeZone;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-2xl">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {timedBlocked ? t("timezoneRequired") : t("formDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="min-h-0 flex-1 overflow-y-auto">
          <form
            id="calendar-event-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="title">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="calendar-event-title">{t("titleLabel")}</FieldLabel>
                      <Input
                        id="calendar-event-title"
                        value={field.state.value}
                        maxLength={MAX_EVENT_TITLE_LENGTH}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="description">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>{t("descriptionLabel")}</FieldLabel>
                      <AnnouncementEditor
                        value={field.state.value}
                        onChange={field.handleChange}
                        onSubmit={() => void form.handleSubmit()}
                        placeholder={t("descriptionPlaceholder")}
                      />
                      <FieldDescription>{t("bodyLinkHint")}</FieldDescription>
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="allDay">
                {(field) => (
                  <Field>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                      <FieldLabel htmlFor="calendar-event-all-day">{t("allDay")}</FieldLabel>
                      <Switch
                        id="calendar-event-all-day"
                        checked={field.state.value}
                        disabled={timedBlocked}
                        onCheckedChange={(checked) => field.handleChange(checked)}
                      />
                    </div>
                  </Field>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.values.allDay}>
                {(allDay) => (
                  <div className="grid grid-cols-2 gap-3">
                    <form.Field name="startDateKey">
                      {(field) => (
                        <DatePickerField
                          id="calendar-event-start-date"
                          label={t("startDate")}
                          value={field.state.value}
                          error={fieldErrorMessage(field.state.meta.errors)}
                          onChange={(next) => {
                            field.handleChange(next);
                            syncEndFromStart(next, form.getFieldValue("startTime"));
                          }}
                        />
                      )}
                    </form.Field>
                    <form.Field name="endDateKey">
                      {(field) => (
                        <DatePickerField
                          id="calendar-event-end-date"
                          label={t("endDate")}
                          value={field.state.value}
                          error={fieldErrorMessage(field.state.meta.errors)}
                          onChange={(next) => {
                            endManuallyAdjustedRef.current = true;
                            field.handleChange(next);
                          }}
                        />
                      )}
                    </form.Field>
                    <form.Field name="startTime">
                      {(field) => {
                        const error = fieldErrorMessage(field.state.meta.errors);
                        return (
                          <Field data-invalid={error ? true : undefined}>
                            <FieldLabel htmlFor="calendar-event-start-time">
                              {t("startTime")}
                            </FieldLabel>
                            <Input
                              id="calendar-event-start-time"
                              type="time"
                              value={field.state.value}
                              disabled={allDay || timedBlocked}
                              onChange={(event) => {
                                const next = event.target.value;
                                field.handleChange(next);
                                syncEndFromStart(form.getFieldValue("startDateKey"), next);
                              }}
                              aria-invalid={error ? true : undefined}
                            />
                            {error ? <FieldError>{error}</FieldError> : null}
                          </Field>
                        );
                      }}
                    </form.Field>
                    <form.Field name="endTime">
                      {(field) => {
                        const error = fieldErrorMessage(field.state.meta.errors);
                        return (
                          <Field data-invalid={error ? true : undefined}>
                            <FieldLabel htmlFor="calendar-event-end-time">
                              {t("endTime")}
                            </FieldLabel>
                            <Input
                              id="calendar-event-end-time"
                              type="time"
                              value={field.state.value}
                              disabled={allDay || timedBlocked}
                              onChange={(event) => {
                                endManuallyAdjustedRef.current = true;
                                field.handleChange(event.target.value);
                              }}
                              aria-invalid={error ? true : undefined}
                            />
                            {error ? <FieldError>{error}</FieldError> : null}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </div>
                )}
              </form.Subscribe>

              <form.Field name="audienceKind">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("audienceLabel")}</FieldLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={field.state.value === "all" ? "default" : "outline"}
                        onClick={() => field.handleChange("all")}
                      >
                        {t("audienceAll")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={field.state.value === "roles" ? "default" : "outline"}
                        onClick={() => field.handleChange("roles")}
                      >
                        {t("audienceRoles")}
                      </Button>
                    </div>
                  </Field>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.values.audienceKind}>
                {(audienceKind) =>
                  audienceKind === "roles" ? (
                    <form.Field name="audienceRoles">
                      {(field) => {
                        const error = fieldErrorMessage(field.state.meta.errors);
                        return (
                          <Field data-invalid={error ? true : undefined}>
                            <FieldLabel>{t("audienceRoles")}</FieldLabel>
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
                  ) : null
                }
              </form.Subscribe>

              <form.Field name="reminders" mode="array">
                {(field) => {
                  const remindersError = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={remindersError ? true : undefined}>
                      <div className="flex items-center justify-between gap-2">
                        <FieldLabel>{t("remindersLabel")}</FieldLabel>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            timedBlocked || field.state.value.length >= MAX_REMINDERS_PER_EVENT
                          }
                          onClick={() =>
                            field.pushValue({ amount: 1, unit: "day", notifyRoles: [] })
                          }
                        >
                          <PlusIcon />
                          {t("addReminder")}
                        </Button>
                      </div>
                      {remindersError ? <FieldError>{remindersError}</FieldError> : null}
                      {timedBlocked ? (
                        <Alert variant="warning" className="rounded-xl px-3 py-2">
                          <TriangleAlertIcon />
                          <AlertDescription className="text-foreground">
                            {t("remindersNeedTimezone")}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="flex flex-col gap-3">
                        {field.state.value.map((_, index) => (
                          <div
                            key={index}
                            className="flex flex-col gap-2 rounded-xl border border-border p-3"
                          >
                            <div className="flex items-center gap-2">
                              <form.Field name={`reminders[${index}].amount`}>
                                {(amountField) => {
                                  const error = fieldErrorMessage(amountField.state.meta.errors);
                                  return (
                                    <Field
                                      data-invalid={error ? true : undefined}
                                      className="min-w-0 flex-1"
                                    >
                                      <NumberInput
                                        value={amountField.state.value}
                                        min={1}
                                        max={MAX_REMINDER_AMOUNT}
                                        aria-label={t("reminderAmount")}
                                        aria-invalid={error ? true : undefined}
                                        onValueChange={amountField.handleChange}
                                      />
                                      {error ? <FieldError>{error}</FieldError> : null}
                                    </Field>
                                  );
                                }}
                              </form.Field>
                              <form.Field name={`reminders[${index}].unit`}>
                                {(unitField) => (
                                  <Select
                                    value={unitField.state.value}
                                    onValueChange={(next) => {
                                      if (
                                        next &&
                                        (REMINDER_UNITS as ReadonlyArray<string>).includes(next)
                                      ) {
                                        unitField.handleChange(next as ReminderUnit);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {REMINDER_UNITS.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {t(`unit_${unit}`)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </form.Field>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-sm"
                                className="shrink-0"
                                aria-label={t("removeReminder")}
                                onClick={() => field.removeValue(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Field>
                  );
                }}
              </form.Field>

              <ImageDocumentAttachmentsField
                classId={classId}
                max={MAX_CALENDAR_EVENT_ATTACHMENTS}
                fileIds={attachmentFileIds}
                items={attachmentItems}
                onUploaded={onUploaded}
                onRemove={onRemove}
              />
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="shrink-0">
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button type="submit" form="calendar-event-form">
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
