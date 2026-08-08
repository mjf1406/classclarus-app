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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_EXPECTATION_DESCRIPTION_LENGTH,
  MAX_EXPECTATION_NAME_LENGTH,
  MAX_EXPECTATION_UNIT_LENGTH,
  type ExpectationFormValues,
  type ExpectationInputType,
  type ExpectationListItem,
} from "@/lib/expectations/expectations";

type ExpectationFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ExpectationListItem | null;
  onSubmit: (values: ExpectationFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  inputType: ExpectationInputType;
  unit: string;
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

export function ExpectationFormCredenza({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: ExpectationFormCredenzaProps) {
  const { t } = useTranslation("expectations");
  const { t: tCommon } = useTranslation("common");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      inputType: initial?.inputType ?? "number",
      unit: initial?.unit ?? "",
    }),
    [initial],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("nameRequired"))
          .max(MAX_EXPECTATION_NAME_LENGTH, t("nameTooLong", { max: MAX_EXPECTATION_NAME_LENGTH })),
        description: z
          .string()
          .max(
            MAX_EXPECTATION_DESCRIPTION_LENGTH,
            t("descriptionTooLong", { max: MAX_EXPECTATION_DESCRIPTION_LENGTH }),
          ),
        inputType: z.enum(["number", "numberRange"]),
        unit: z
          .string()
          .trim()
          .min(1, t("unitRequired"))
          .max(MAX_EXPECTATION_UNIT_LENGTH, t("unitTooLong", { max: MAX_EXPECTATION_UNIT_LENGTH })),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) return undefined;
        const fieldErrors: Partial<Record<"name" | "description" | "inputType" | "unit", string>> =
          {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "name" || key === "description" || key === "inputType" || key === "unit") {
            fieldErrors[key] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.name,
          description: parsed.description.trim() || undefined,
          inputType: parsed.inputType,
          unit: parsed.unit,
        });
      } catch (error) {
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
  }, [form, open]);

  const inputTypeChanged =
    mode === "edit" && initial != null && form.state.values.inputType !== initial.inputType;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-lg">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>{t("nameLabel")}</FieldLabel>
                      <Input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        autoComplete="off"
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
                      <FieldLabel>
                        {t("descriptionLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Textarea
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        rows={3}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="inputType">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>{t("inputTypeLabel")}</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next) => {
                          if (next !== "number" && next !== "numberRange") return;
                          field.handleChange(next);
                        }}
                      >
                        <SelectTrigger className="w-full" aria-label={t("inputTypeLabel")}>
                          <SelectValue>
                            {field.state.value === "numberRange"
                              ? t("inputTypeNumberRange")
                              : t("inputTypeNumber")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="number">{t("inputTypeNumber")}</SelectItem>
                            <SelectItem value="numberRange">{t("inputTypeNumberRange")}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {error ? <FieldError>{error}</FieldError> : null}
                      {inputTypeChanged ? (
                        <p className="text-sm text-muted-foreground">
                          {t("inputTypeChangeWarning")}
                        </p>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="unit">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>{t("unitLabel")}</FieldLabel>
                      <Input
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        autoComplete="off"
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 flex-row gap-2 sm:justify-between">
            <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit" className="flex-1">
              {t("saveAction")}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
