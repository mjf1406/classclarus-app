import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  classFormSchema,
  isEmojiIcon,
  isFontAwesomeIconId,
  type ClassFormValues,
} from "@/lib/classes/classFormSchema";

type IconMode = "fontawesome" | "emoji";

export type ClassFormCredenzaMode = "create" | "edit";

export type ClassFormInitialValues = {
  name: string;
  year: number;
  description?: string;
  icon?: string;
};

type ClassFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ClassFormCredenzaMode;
  initialValues?: ClassFormInitialValues;
  onSubmit: (values: ClassFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  year: string;
  description: string;
  icon: string;
};

function defaultYear(): number {
  return new Date().getFullYear();
}

function resolveIconMode(icon: string | undefined): IconMode {
  if (icon && isEmojiIcon(icon)) return "emoji";
  return "fontawesome";
}

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

export function ClassFormCredenza({
  open,
  onOpenChange,
  mode,
  initialValues,
  onSubmit,
}: ClassFormCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [iconMode, setIconMode] = useState<IconMode>("fontawesome");
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initialValues?.name ?? "",
      year: String(initialValues?.year ?? defaultYear()),
      description: initialValues?.description ?? "",
      icon: initialValues?.icon ?? "",
    }),
    [initialValues],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const applyIconState = useCallback((icon: string) => {
    const modeForIcon = resolveIconMode(icon || undefined);
    setIconMode(modeForIcon);
    if (icon && isFontAwesomeIconId(icon)) {
      void resolveIconId(icon).then((resolved) => {
        setFaIcon(resolved);
      });
    } else {
      setFaIcon(null);
    }
  }, []);

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: classFormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = classFormSchema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit(parsed);
        skipNextResetRef.current = false;
        const values = defaultsRef.current;
        form.reset(values);
        setSubmitError(null);
        applyIconState(values.icon);
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  const resetForm = useCallback(
    (values: FormDefaults) => {
      form.reset(values);
      setSubmitError(null);
      applyIconState(values.icon);
    },
    [applyIconState, form],
  );

  useEffect(() => {
    if (!open) {
      if (!skipNextResetRef.current) {
        resetForm(defaults);
      }
      return;
    }
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    resetForm(defaults);
  }, [open, defaults, resetForm]);

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
            id="class-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              <form.Field name="name">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="class-name">
                        {t("nameLabel")}
                        <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <Input
                        id="class-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        aria-required={true}
                        placeholder={t("namePlaceholder")}
                        autoComplete="off"
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="year">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="class-year">
                        {t("yearLabel")}
                        <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <Input
                        id="class-year"
                        type="number"
                        inputMode="numeric"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        aria-required={true}
                        placeholder={t("yearPlaceholder")}
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
                      <FieldLabel htmlFor="class-description">
                        {t("descriptionLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Textarea
                        id="class-description"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                            event.preventDefault();
                            void form.handleSubmit();
                          }
                        }}
                        aria-invalid={error ? true : undefined}
                        placeholder={t("descriptionPlaceholder")}
                        rows={3}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="icon">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>
                        {t("iconLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[iconMode]}
                        onValueChange={(values) => {
                          const next = values[0] as IconMode | undefined;
                          if (!next || next === iconMode) return;
                          setIconMode(next);
                          setFaIcon(null);
                          field.handleChange("");
                        }}
                      >
                        <ToggleGroupItem value="fontawesome">
                          {t("iconModeFontAwesome")}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="emoji">{t("iconModeEmoji")}</ToggleGroupItem>
                      </ToggleGroup>
                      {iconMode === "fontawesome" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <FontAwesomeIconPickerLazy
                            value={faIcon}
                            onChange={(icon) => {
                              setFaIcon(icon);
                              field.handleChange(iconDefinitionToId(icon));
                            }}
                            placeholder={t("iconPickerPlaceholder")}
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
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="class-emoji"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={error ? true : undefined}
                            placeholder={t("emojiPlaceholder")}
                            autoComplete="off"
                            className="max-w-[12rem]"
                          />
                          {field.state.value ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => field.handleChange("")}
                            >
                              {t("clearIcon")}
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
            {submitError ? (
              <p className="text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                form="class-form"
                className="flex-1"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting
                  ? t("saving")
                  : mode === "create"
                    ? t("createSubmit")
                    : t("editSubmit")}
              </Button>
            )}
          </form.Subscribe>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
