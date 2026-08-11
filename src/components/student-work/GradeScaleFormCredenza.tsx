import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Trash2 } from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  createClientGradeScaleFormSchema,
  defaultFormLevels,
  levelsFromListItem,
  MAX_GRADE_SCALE_LEVELS,
  type GradeScaleFormLevel,
  type GradeScaleFormValues,
  type GradeScaleListItem,
} from "@/lib/gradeScales/gradeScales";
import {
  rowFocusKeyProps,
  rowFocusTargetProps,
  usePendingRowFocus,
} from "@/hooks/usePendingRowFocus";

type GradeScaleFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: GradeScaleListItem | null;
  onSubmit: (values: GradeScaleFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  levels: GradeScaleFormLevel[];
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

export function GradeScaleFormCredenza({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: GradeScaleFormCredenzaProps) {
  const { t } = useTranslation("studentWork");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const { queueRowFocus, clearPendingRowFocus } = usePendingRowFocus();

  const defaults = useMemo((): FormDefaults => {
    if (mode === "edit" && initial) {
      return {
        name: initial.name ?? "",
        levels: levelsFromListItem(initial),
      };
    }
    return {
      name: "",
      levels: defaultFormLevels(),
    };
  }, [initial, mode]);

  const schema = useMemo(() => createClientGradeScaleFormSchema(t), [t]);

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message ?? t("saveFailed");
        const root = issue?.path[0];

        if (root === "levels") {
          setLevelsError(message);
          setSubmitError(null);
        } else if (root === "name") {
          form.setFieldMeta("name", (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onSubmit: message },
            errors: [message],
          }));
          setLevelsError(null);
          setSubmitError(null);
        } else {
          setLevelsError(null);
          setSubmitError(message);
        }
        return;
      }

      setLevelsError(null);
      setSubmitError(null);
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.data.name,
          levels: parsed.data.levels,
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
    form.reset(defaults);
    setSubmitError(null);
    setLevelsError(null);
    clearPendingRowFocus();
  }, [open, defaults, form, clearPendingRowFocus]);

  const title = mode === "create" ? t("createScaleTitle") : t("editScaleTitle");

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-lg">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{t("scaleFormDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <form.Field name="name">
              {(field) => (
                <FieldGroup className="shrink-0">
                  <Field>
                    <FieldLabel htmlFor={field.name}>{t("nameLabel")}</FieldLabel>
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

            <form.Field name="levels" mode="array">
              {(levelsField) => {
                const addLevel = () => {
                  if (levelsField.state.value.length >= MAX_GRADE_SCALE_LEVELS) return;
                  const rowKey = crypto.randomUUID();
                  setLevelsError(null);
                  levelsField.pushValue({
                    key: rowKey,
                    label: "",
                    minPercent: 0,
                    maxPercent: 0,
                  });
                  queueRowFocus(rowKey);
                };

                return (
                  <FieldGroup className="flex min-h-0 flex-1 flex-col gap-3">
                    <FieldLabel className="shrink-0">{t("levelsLabel")}</FieldLabel>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                      {levelsField.state.value.map((level, index) => (
                        <div
                          key={level.key ?? index}
                          {...rowFocusKeyProps(level.key ?? String(index))}
                          className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-end gap-x-3 gap-y-2 rounded-lg bg-muted/40 p-3"
                        >
                          <form.Field name={`levels[${index}].label`}>
                            {(field) => (
                              <Field className="min-w-0">
                                <FieldLabel className="sr-only">{t("levelLabelField")}</FieldLabel>
                                <Input
                                  {...rowFocusTargetProps()}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    setLevelsError(null);
                                    field.handleChange(event.target.value);
                                  }}
                                  placeholder={t("levelLabelField")}
                                />
                                <FieldError>
                                  {fieldErrorMessage(field.state.meta.errors)}
                                </FieldError>
                              </Field>
                            )}
                          </form.Field>
                          <div className="grid min-w-0 grid-cols-2 gap-3">
                            <form.Field name={`levels[${index}].minPercent`}>
                              {(field) => (
                                <Field className="min-w-0">
                                  <FieldLabel className="text-xs">
                                    {t("minPercentLabel")}
                                  </FieldLabel>
                                  <NumberInput
                                    value={field.state.value}
                                    onValueChange={(value) => {
                                      setLevelsError(null);
                                      field.handleChange(value ?? 0);
                                    }}
                                    min={0}
                                    max={100}
                                  />
                                </Field>
                              )}
                            </form.Field>
                            <form.Field name={`levels[${index}].maxPercent`}>
                              {(field) => (
                                <Field className="min-w-0">
                                  <FieldLabel className="text-xs">
                                    {t("maxPercentLabel")}
                                  </FieldLabel>
                                  <NumberInput
                                    value={field.state.value}
                                    onValueChange={(value) => {
                                      setLevelsError(null);
                                      field.handleChange(value ?? 0);
                                    }}
                                    min={0}
                                    max={100}
                                  />
                                </Field>
                              )}
                            </form.Field>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            className="shrink-0"
                            disabled={levelsField.state.value.length <= 1}
                            aria-label={t("removeLevel")}
                            onClick={() => {
                              setLevelsError(null);
                              levelsField.removeValue(index);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
                      disabled={levelsField.state.value.length >= MAX_GRADE_SCALE_LEVELS}
                      onClick={addLevel}
                    >
                      {t("addLevel")}
                    </Button>
                    {levelsError ? (
                      <FieldError className="shrink-0">{levelsError}</FieldError>
                    ) : null}
                  </FieldGroup>
                );
              }}
            </form.Field>

            {submitError ? (
              <p className="shrink-0 text-sm text-destructive">{submitError}</p>
            ) : null}
          </CredenzaBody>
          <CredenzaFooter className="shrink-0">
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit">{t("saveAction")}</Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
