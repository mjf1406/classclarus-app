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
  formValuesToPurchaseLimit,
  purchaseLimitToFormValues,
  validatePurchaseLimitFormValues,
  type PurchaseLimitFormValues,
} from "@/lib/rewards/purchaseLimit";
import {
  MAX_REWARD_DESCRIPTION_LENGTH,
  MAX_REWARD_NAME_LENGTH,
  MAX_REWARD_POINTS,
  type RewardFolderListItem,
  type RewardFormValues,
  type RewardListItem,
} from "@/lib/rewards/rewards";
import type { Id } from "../../../convex/_generated/dataModel";

const NONE_FOLDER = "__none__";

type RewardFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  folders: Array<RewardFolderListItem>;
  initial?: RewardListItem | null;
  onSubmit: (values: RewardFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  icon: string;
  points: string;
  folderId: string;
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

export function RewardFormCredenza({
  open,
  onOpenChange,
  mode,
  folders,
  initial,
  onSubmit,
}: RewardFormCredenzaProps) {
  const { t } = useTranslation("rewards");
  const { t: tCommon } = useTranslation("common");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const skipNextResetRef = useRef(false);

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      icon: initial?.icon ?? "",
      points: initial ? String(initial.points) : "1",
      folderId: initial?.folderId ?? NONE_FOLDER,
      purchaseLimit: purchaseLimitToFormValues(initial?.purchaseLimit),
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
          .max(MAX_REWARD_NAME_LENGTH, t("nameTooLong", { max: MAX_REWARD_NAME_LENGTH })),
        description: z
          .string()
          .max(
            MAX_REWARD_DESCRIPTION_LENGTH,
            t("descriptionTooLong", { max: MAX_REWARD_DESCRIPTION_LENGTH }),
          ),
        icon: z.string(),
        points: z
          .string()
          .trim()
          .regex(/^\d+$/, t("pointsInvalid"))
          .refine(
            (value) => {
              const n = Number(value);
              return Number.isInteger(n) && n >= 0 && n <= MAX_REWARD_POINTS;
            },
            t("pointsOutOfRange", { max: MAX_REWARD_POINTS }),
          ),
        folderId: z.string(),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        const fieldErrors: Partial<
          Record<"name" | "description" | "icon" | "points" | "folderId" | "purchaseLimit", string>
        > = {};
        if (!result.success) {
          for (const issue of result.error.issues) {
            const key = issue.path[0];
            if (
              key === "name" ||
              key === "description" ||
              key === "icon" ||
              key === "points" ||
              key === "folderId"
            ) {
              fieldErrors[key] = issue.message;
            }
          }
        }
        const limitErrors = validatePurchaseLimitFormValues(value.purchaseLimit, t);
        if (limitErrors?.maxPurchases) {
          fieldErrors.purchaseLimit = limitErrors.maxPurchases;
        } else if (limitErrors?.every) {
          fieldErrors.purchaseLimit = limitErrors.every;
        }
        return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      const description = parsed.description.trim() || undefined;
      const icon = parsed.icon.trim() || undefined;
      const folderId =
        parsed.folderId === NONE_FOLDER ? undefined : (parsed.folderId as Id<"rewardFolders">);
      const purchaseLimit = formValuesToPurchaseLimit(value.purchaseLimit);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.name,
          description,
          icon,
          points: Number(parsed.points),
          folderId,
          purchaseLimit,
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
          <CredenzaBody className="min-h-0 flex-1 overflow-y-auto">
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="reward-name">{t("nameLabel")}</FieldLabel>
                      <Input
                        id="reward-name"
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
                      <FieldLabel htmlFor="reward-description">
                        {t("descriptionLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Textarea
                        id="reward-description"
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

              <form.Field name="points">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="reward-points">{t("pointsLabel")}</FieldLabel>
                      <Input
                        id="reward-points"
                        inputMode="numeric"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="folderId">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  const selectedFolder = folders.find((folder) => folder._id === field.state.value);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel>
                        {t("folderLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next) => {
                          if (next == null) return;
                          field.handleChange(next);
                        }}
                      >
                        <SelectTrigger className="w-full" aria-label={t("folderLabel")}>
                          <SelectValue>
                            {field.state.value === NONE_FOLDER
                              ? t("folderNone")
                              : (selectedFolder?.name ?? t("folderNone"))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={NONE_FOLDER}>{t("folderNone")}</SelectItem>
                            {folders.map((folder) => (
                              <SelectItem key={folder._id} value={folder._id}>
                                {folder.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="purchaseLimit">
                {(field) => {
                  const limitErrors = validatePurchaseLimitFormValues(field.state.value, t);
                  return (
                    <PurchaseLimitFields
                      t={t}
                      tipVariant="item"
                      values={field.state.value}
                      onChange={field.handleChange}
                      errors={limitErrors}
                    />
                  );
                }}
              </form.Field>
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
