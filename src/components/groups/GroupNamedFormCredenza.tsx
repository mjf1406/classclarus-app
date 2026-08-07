import { useEffect, useMemo, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  groupFormSchema,
  type AlsoCreateInGroupOption,
  type GroupFormSchemaValues,
} from "@/lib/groups/groupFormSchema";
import type { Id } from "../../../convex/_generated/dataModel";

export type GroupNamedFormKind = "group" | "team";
export type GroupNamedFormMode = "create" | "edit";

type GroupNamedFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: GroupNamedFormKind;
  mode: GroupNamedFormMode;
  /** Other groups available when creating a team (excludes the source group). */
  alsoCreateInGroupOptions?: Array<AlsoCreateInGroupOption>;
  initialValues?: {
    name: string;
    description?: string;
    icon?: string;
  };
  onSubmit: (values: GroupFormSchemaValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  icon: string;
  alsoCreateInGroupIds: Array<Id<"groups">>;
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

export function GroupNamedFormCredenza({
  open,
  onOpenChange,
  kind,
  mode,
  alsoCreateInGroupOptions = [],
  initialValues,
  onSubmit,
}: GroupNamedFormCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const chipsAnchorRef = useRef<HTMLDivElement | null>(null);
  const showAlsoCreateIn =
    kind === "team" && mode === "create" && alsoCreateInGroupOptions.length > 0;

  const defaults = useMemo(
    (): FormDefaults => ({
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      icon: initialValues?.icon ?? "",
      alsoCreateInGroupIds: [],
    }),
    [initialValues],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const titleKey =
    kind === "group"
      ? mode === "create"
        ? "groupsCreateTitle"
        : "groupsEditTitle"
      : mode === "create"
        ? "teamsCreateTitle"
        : "teamsEditTitle";

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const parsed = groupFormSchema.safeParse({
          name: value.name,
          description: value.description || undefined,
          icon: value.icon || undefined,
        });
        if (parsed.success) return undefined;
        const fieldErrors: Partial<Record<"name" | "description" | "icon", string>> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (key === "name" || key === "description" || key === "icon") {
            fieldErrors[key] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = groupFormSchema.parse({
        name: value.name,
        description: value.description || undefined,
        icon: value.icon || undefined,
      });
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        const alsoIds = showAlsoCreateIn
          ? [...new Set(value.alsoCreateInGroupIds)].filter((id) =>
              alsoCreateInGroupOptions.some((option) => option.value === id),
            )
          : [];
        await onSubmit({
          name: parsed.name,
          ...(parsed.description ? { description: parsed.description } : {}),
          ...(parsed.icon ? { icon: parsed.icon } : {}),
          ...(alsoIds.length > 0 ? { alsoCreateInGroupIds: alsoIds } : {}),
        });
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("groupsSaveFailed"));
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
  }, [open, form, kind, mode, defaults]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t(titleKey)}</CredenzaTitle>
          <CredenzaDescription className="sr-only">{t(titleKey)}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor={`group-name-${kind}`}>{t("groupsNameLabel")}</FieldLabel>
                      <Input
                        id={`group-name-${kind}`}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
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
                      <FieldLabel htmlFor={`group-description-${kind}`}>
                        {t("groupsDescriptionLabel")}
                        <span className="font-normal text-muted-foreground">
                          ({tCommon("optional")})
                        </span>
                      </FieldLabel>
                      <Textarea
                        id={`group-description-${kind}`}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
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
                        {t("groupsIconLabel")}
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
                          placeholder={t("groupsIconPickerPlaceholder")}
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

              {showAlsoCreateIn ? (
                <form.Field name="alsoCreateInGroupIds">
                  {(field) => {
                    const selectedValue = alsoCreateInGroupOptions.filter((option) =>
                      field.state.value.includes(option.value),
                    );
                    return (
                      <Field>
                        <FieldLabel>
                          {t("teamsAlsoCreateInLabel")}
                          <span className="font-normal text-muted-foreground">
                            ({tCommon("optional")})
                          </span>
                        </FieldLabel>
                        <FieldDescription>{t("teamsAlsoCreateInDescription")}</FieldDescription>
                        <Combobox
                          multiple
                          items={alsoCreateInGroupOptions}
                          value={selectedValue}
                          isItemEqualToValue={(a, b) => a.value === b.value}
                          onValueChange={(next) => {
                            field.handleChange((next ?? []).map((item) => item.value));
                          }}
                        >
                          <ComboboxChips ref={chipsAnchorRef} className="w-full">
                            <ComboboxValue>
                              {(values: AlsoCreateInGroupOption[]) =>
                                values.map((item) => (
                                  <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                                ))
                              }
                            </ComboboxValue>
                            <ComboboxChipsInput
                              placeholder={
                                selectedValue.length === 0
                                  ? t("teamsAlsoCreateInPlaceholder")
                                  : undefined
                              }
                              aria-label={t("teamsAlsoCreateInLabel")}
                            />
                          </ComboboxChips>
                          <ComboboxContent anchor={chipsAnchorRef}>
                            <ComboboxEmpty>{t("teamsAlsoCreateInEmpty")}</ComboboxEmpty>
                            <ComboboxList>
                              {(item: AlsoCreateInGroupOption) => (
                                <ComboboxItem key={item.value} value={item}>
                                  {item.label}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </Field>
                    );
                  }}
                </form.Field>
              ) : null}
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              void form.handleSubmit();
            }}
          >
            {mode === "create" ? t("createSubmit") : t("editSubmit")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
