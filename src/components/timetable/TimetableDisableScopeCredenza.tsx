import { useEffect, useMemo, useRef, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSetSlotsDisabled } from "@/hooks/timetable/useTimetableMutations";
import {
  createClientTimetableDisableScopeFormSchema,
  type TimetableDisableScopeFormValues,
} from "@/lib/timetable/timetableFormSchema";
import type { TimetableSlot } from "@/lib/timetable/timetable";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SlotDisableScope } from "../../../convex/lib/timetable/slotDisableScope";

export type TimetableDisableTarget =
  | { kind: "slot"; slot: TimetableSlot; disabled: boolean }
  | { kind: "day"; day: string; disabled: boolean };

type TimetableDisableScopeCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
  target: TimetableDisableTarget | null;
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

export function TimetableDisableScopeCredenza({
  open,
  onOpenChange,
  classId,
  termId,
  year,
  weekNumber,
  target,
}: TimetableDisableScopeCredenzaProps) {
  const { t } = useTranslation("timetable");
  const setDisabled = useSetSlotsDisabled();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const schema = useMemo(() => createClientTimetableDisableScopeFormSchema(t), [t]);

  const form = useForm({
    defaultValues: { scope: "thisWeek" } satisfies TimetableDisableScopeFormValues,
    onSubmit: async ({ value }) => {
      if (!target) return;
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? t("saveFailed");
        form.setFieldMeta("scope", (prev) => ({
          ...prev,
          errorMap: { ...prev.errorMap, onSubmit: message },
          errors: [message],
        }));
        return;
      }

      setSubmitError(null);
      onOpenChange(false);
      try {
        await setDisabled.mutateAsync({
          classId,
          termId,
          year,
          weekNumber,
          disabled: target.disabled,
          scope: parsed.data.scope,
          slotId: target.kind === "slot" ? target.slot._id : undefined,
          day: target.kind === "day" ? target.day : undefined,
        });
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
    form.reset({ scope: "thisWeek" });
    setSubmitError(null);
  }, [open, form, target]);

  if (!target) return null;

  const title =
    target.kind === "slot"
      ? target.disabled
        ? t("disableScopeTitleDisableSlot")
        : t("disableScopeTitleEnableSlot")
      : target.disabled
        ? t("disableScopeTitleDisableDay")
        : t("disableScopeTitleEnableDay");

  const scopes: Array<SlotDisableScope> = ["thisWeek", "fromWeek", "allWeeks"];

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{t("disableScopeDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-4">
            <form.Field name="scope">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length ? true : undefined}>
                  <FieldLabel>{t("disableScopeLabel")}</FieldLabel>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value === "thisWeek" || value === "fromWeek" || value === "allWeeks") {
                        field.handleChange(value);
                      }
                    }}
                    className="gap-2"
                  >
                    {scopes.map((scope) => (
                      <label
                        key={scope}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5"
                      >
                        <RadioGroupItem value={scope} />
                        <span className="text-sm">
                          {scope === "thisWeek"
                            ? t("disableScopeThisWeek")
                            : scope === "fromWeek"
                              ? t("disableScopeFromWeek")
                              : t("disableScopeAllWeeks")}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit" disabled={setDisabled.isPending}>
              {target.disabled ? t("confirmDisableAction") : t("confirmEnableAction")}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
