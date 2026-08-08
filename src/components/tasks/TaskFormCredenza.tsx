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
import { Textarea } from "@/components/ui/textarea";
import { coerceDueDateKeyForInput, normalizeDueDateKey } from "@/lib/dueDate/dueDateKey";
import {
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_NAME_LENGTH,
  type TaskDetail,
  type TaskListItem,
} from "@/lib/tasks/tasks";

type TaskFormValues = {
  name: string;
  description?: string;
  dueDateKey?: string;
};

type TaskFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: TaskListItem | TaskDetail | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  dueDateKey: string;
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

export function TaskFormCredenza({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: TaskFormCredenzaProps) {
  const { t } = useTranslation("tasks");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      dueDateKey: coerceDueDateKeyForInput(initial?.dueDateKey),
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
          .max(MAX_TASK_NAME_LENGTH, t("nameTooLong", { max: MAX_TASK_NAME_LENGTH })),
        description: z
          .string()
          .max(
            MAX_TASK_DESCRIPTION_LENGTH,
            t("descriptionTooLong", { max: MAX_TASK_DESCRIPTION_LENGTH }),
          ),
        dueDateKey: z.string(),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) return undefined;
        const fieldErrors: Partial<Record<"name" | "description" | "dueDateKey", string>> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "name" || key === "description" || key === "dueDateKey") {
            fieldErrors[key] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      const description = parsed.description.trim() || undefined;
      const trimmedDue = parsed.dueDateKey.trim();
      const dueDateKey = trimmedDue ? (normalizeDueDateKey(trimmedDue) ?? undefined) : undefined;
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.name,
          description,
          dueDateKey,
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
    setSubmitError(null);
    form.reset(defaultsRef.current);
  }, [open, form]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-lg">
        <CredenzaHeader>
          <CredenzaTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <form
            id="task-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("nameLabel")}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoComplete="off"
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="description">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("descriptionLabel")}</FieldLabel>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        rows={3}
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="dueDateKey">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("dueDateLabel")}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button type="submit" form="task-form" className="flex-1">
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
