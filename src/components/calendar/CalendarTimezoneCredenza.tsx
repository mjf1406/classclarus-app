import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { TimezoneSelect } from "@/components/classes/TimezoneSelect";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  createTimezoneFormSchema,
  type TimezoneFormValues,
} from "../../../convex/lib/calendar/timezoneFormSchema";
import { detectBrowserTimeZone } from "../../../convex/lib/calendar/timeZone";

type CalendarTimezoneCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTimezone?: string;
  onSubmit: (timezone: string) => Promise<void>;
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

export function CalendarTimezoneCredenza({
  open,
  onOpenChange,
  initialTimezone,
  onSubmit,
}: CalendarTimezoneCredenzaProps) {
  const { t } = useTranslation("calendar");
  const { t: tClasses } = useTranslation("classes");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): TimezoneFormValues => ({
      timezone: initialTimezone || detectBrowserTimeZone() || "",
    }),
    [initialTimezone],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(
    () =>
      createTimezoneFormSchema({
        timezoneRequired: t("timezoneRequired"),
        timezoneInvalid: t("timezoneInvalid"),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit(parsed.timezone);
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : tClasses("timezoneSaveFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    setSubmitError(null);
    form.reset(defaultsRef.current);
  }, [open, form]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{tClasses("timezoneTitle")}</CredenzaTitle>
          <CredenzaDescription>{tClasses("timezoneDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="overflow-visible">
          <form
            id="calendar-timezone-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="timezone">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="calendar-class-timezone">
                        {tClasses("timezoneTitle")}
                      </FieldLabel>
                      <TimezoneSelect
                        id="calendar-class-timezone"
                        value={field.state.value || undefined}
                        onValueChange={field.handleChange}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button type="submit" form="calendar-timezone-form">
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
