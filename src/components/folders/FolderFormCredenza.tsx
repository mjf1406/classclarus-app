import { useEffect, useMemo, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
import { PurchaseLimitFields } from "@/components/rewards/PurchaseLimitFields";
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
import {
  MAX_FOLDER_DESCRIPTION_LENGTH,
  MAX_FOLDER_NAME_LENGTH,
  type FolderFormValues,
  type FolderI18nNamespace,
} from "@/lib/folders/folders";
import {
  emptyPurchaseLimitFormValues,
  formValuesToPurchaseLimit,
  purchaseLimitToFormValues,
  validatePurchaseLimitFormValues,
  type PurchaseLimit,
  type PurchaseLimitFormValues,
} from "@/lib/rewards/purchaseLimit";

type FolderFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  namespace?: FolderI18nNamespace;
  supportsPurchaseLimit?: boolean;
  initial?: {
    name: string;
    description?: string;
    icon?: string;
    purchaseLimit?: PurchaseLimit;
  } | null;
  onSubmit: (values: FolderFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  icon: string;
  purchaseLimit: PurchaseLimitFormValues;
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

export function FolderFormCredenza({
  open,
  onOpenChange,
  mode,
  namespace = "behaviors",
  supportsPurchaseLimit = false,
  initial,
  onSubmit,
}: FolderFormCredenzaProps) {
  const { t } = useTranslation(namespace);
  const { t: tRewards } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      icon: initial?.icon ?? "",
      purchaseLimit: supportsPurchaseLimit
        ? purchaseLimitToFormValues(initial?.purchaseLimit)
        : emptyPurchaseLimitFormValues(),
    }),
    [initial, supportsPurchaseLimit],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("folderNameRequired"))
          .max(MAX_FOLDER_NAME_LENGTH, t("folderNameTooLong", { max: MAX_FOLDER_NAME_LENGTH })),
        description: z
          .string()
          .max(
            MAX_FOLDER_DESCRIPTION_LENGTH,
            t("folderDescriptionTooLong", { max: MAX_FOLDER_DESCRIPTION_LENGTH }),
          ),
        icon: z.string(),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        const fieldErrors: Partial<
          Record<"name" | "description" | "icon" | "purchaseLimit", string>
        > = {};
        if (!result.success) {
          for (const issue of result.error.issues) {
            const key = issue.path[0];
            if (key === "name" || key === "description" || key === "icon") {
              fieldErrors[key] = issue.message;
            }
          }
        }
        if (supportsPurchaseLimit) {
          const limitErrors = validatePurchaseLimitFormValues(value.purchaseLimit, tRewards);
          if (limitErrors?.maxPurchases) {
            fieldErrors.purchaseLimit = limitErrors.maxPurchases;
          } else if (limitErrors?.every) {
            fieldErrors.purchaseLimit = limitErrors.every;
          }
        }
        return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      const description = parsed.description.trim() || undefined;
      const icon = parsed.icon.trim() || undefined;
      const purchaseLimit = supportsPurchaseLimit
        ? formValuesToPurchaseLimit(value.purchaseLimit)
        : undefined;
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.name,
          description,
          icon,
          ...(supportsPurchaseLimit ? { purchaseLimit } : {}),
        });
        skipNextResetRef.current = false;
        const values = defaultsRef.current;
        form.reset(values);
        setSubmitError(null);
        if (values.icon) {
          void resolveIconId(values.icon).then((resolved) => setFaIcon(resolved));
        } else {
          setFaIcon(null);
        }
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("folderSaveFailed"));
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
    const icon = defaultsRef.current.icon;
    if (icon) {
      void resolveIconId(icon).then((resolved) => setFaIcon(resolved));
    } else {
      setFaIcon(null);
    }
  }, [open, form]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-lg">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>
            {mode === "create" ? t("folderCreateTitle") : t("folderEditTitle")}
          </CredenzaTitle>
          <CredenzaDescription>
            {mode === "create" ? t("folderCreateDescription") : t("folderEditDescription")}
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
          <CredenzaBody className="min-h-0 flex-1 overflow-y-auto">
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="folder-name">{t("folderNameLabel")}</FieldLabel>
                      <Input
                        id="folder-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoFocus
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
                      <FieldLabel htmlFor="folder-description">
                        {t("folderDescriptionLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Textarea
                        id="folder-description"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
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
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              {supportsPurchaseLimit ? (
                <form.Field name="purchaseLimit">
                  {(field) => {
                    const limitErrors = validatePurchaseLimitFormValues(
                      field.state.value,
                      tRewards,
                    );
                    return (
                      <PurchaseLimitFields
                        t={tRewards}
                        tipVariant="folder"
                        values={field.state.value}
                        onChange={field.handleChange}
                        errors={limitErrors}
                      />
                    );
                  }}
                </form.Field>
              ) : null}
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 flex-row justify-between gap-2">
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
