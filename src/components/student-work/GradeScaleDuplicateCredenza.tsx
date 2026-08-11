import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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
import { Input } from "@/components/ui/input";
import {
  MAX_GRADE_SCALE_NAME_LENGTH,
  type GradeScaleListItem,
} from "@/lib/gradeScales/gradeScales";

type GradeScaleDuplicateCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: GradeScaleListItem | null;
  defaultName: string;
  onSubmit: (name: string) => Promise<void>;
};

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  return undefined;
}

export function GradeScaleDuplicateCredenza({
  open,
  onOpenChange,
  source,
  defaultName,
  onSubmit,
}: GradeScaleDuplicateCredenzaProps) {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, tCommon("required")).max(MAX_GRADE_SCALE_NAME_LENGTH),
      }),
    [tCommon],
  );

  const form = useForm({
    defaultValues: { name: defaultName },
    onSubmit: async ({ value }) => {
      if (!source) return;
      const parsed = schema.parse(value);
      setSubmitError(null);
      onOpenChange(false);
      try {
        await onSubmit(parsed.name);
      } catch (error) {
        skipNextResetRef.current = true;
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("duplicateFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    form.reset({ name: defaultName });
    setSubmitError(null);
  }, [open, defaultName, form]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("duplicateScaleTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("scaleFormDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody>
            <form.Field name="name">
              {(field) => (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={field.name}>{t("duplicateNameLabel")}</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      autoComplete="off"
                    />
                    <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                  </Field>
                </FieldGroup>
              )}
            </form.Field>
            {submitError ? <p className="mt-3 text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit">{t("duplicateConfirm")}</Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
