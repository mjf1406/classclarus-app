import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createJoinCodeFormSchema,
  JOIN_CODE_TTL_OPTIONS,
  JOIN_CODE_USE_PRESETS,
  type CreateJoinCodeFormValues,
  type JoinCodeTtlOption,
} from "@/lib/invitations/joinCodeFormSchema";
import { isJoinCodeRole, type JoinCodeRole } from "@/lib/permissions/classPermissions";

type CreateJoinCodeCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignableRoles: Array<JoinCodeRole>;
  onSubmit: (values: CreateJoinCodeFormValues) => Promise<void>;
};

type FormDefaults = {
  role: string;
  ttlOption: JoinCodeTtlOption;
  usesMode: "preset" | "custom";
  usesPreset: string;
  usesCustom: string;
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

function ttlLabelKey(option: JoinCodeTtlOption): string {
  switch (option) {
    case "15m":
      return "inviteTtl15m";
    case "1h":
      return "inviteTtl1h";
    case "6h":
      return "inviteTtl6h";
    case "12h":
      return "inviteTtl12h";
    case "1d":
      return "inviteTtl1d";
  }
}

export function CreateJoinCodeCredenza({
  open,
  onOpenChange,
  assignableRoles,
  onSubmit,
}: CreateJoinCodeCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const usesCustomInputRef = useRef<HTMLInputElement>(null);
  const focusUsesCustomAfterCloseRef = useRef(false);

  const defaults = useMemo((): FormDefaults => {
    const preferredRole =
      assignableRoles.find((role) => role === "student") ?? assignableRoles[0] ?? "";
    return {
      role: preferredRole,
      ttlOption: "15m",
      usesMode: "preset",
      usesPreset: "5",
      usesCustom: "",
    };
  }, [assignableRoles]);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: createJoinCodeFormSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = createJoinCodeFormSchema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit(parsed);
        skipNextResetRef.current = false;
        form.reset(defaultsRef.current);
        setSubmitError(null);
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("createInviteFailed"));
      }
    },
  });

  const resetForm = useCallback(
    (values: FormDefaults) => {
      form.reset(values);
      setSubmitError(null);
    },
    [form],
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
          <CredenzaTitle>{t("createInviteTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("createInviteDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <form
            id="join-code-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              <form.Field name="role">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  const selectedRole =
                    field.state.value && isJoinCodeRole(field.state.value)
                      ? field.state.value
                      : null;
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="invite-role">
                        {t("inviteRoleLabel")}
                        <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <Select
                        value={field.state.value || null}
                        onValueChange={(next) => {
                          if (next != null) field.handleChange(next);
                        }}
                      >
                        <SelectTrigger
                          id="invite-role"
                          className="w-full"
                          aria-invalid={error ? true : undefined}
                        >
                          <SelectValue placeholder={t("inviteRolePlaceholder")}>
                            {selectedRole ? (
                              <ClassRoleSelectLabel role={selectedRole} colored />
                            ) : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {assignableRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                <ClassRoleSelectLabel role={role} />
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

              <form.Field name="ttlOption">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="invite-ttl">
                        {t("inviteTtlLabel")}
                        <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next) => {
                          if (next != null) {
                            field.handleChange(next as JoinCodeTtlOption);
                          }
                        }}
                      >
                        <SelectTrigger
                          id="invite-ttl"
                          className="w-full"
                          aria-invalid={error ? true : undefined}
                        >
                          <SelectValue>{t(ttlLabelKey(field.state.value))}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {JOIN_CODE_TTL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {t(ttlLabelKey(option.value))}
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

              <form.Field name="usesMode">
                {(usesModeField) => (
                  <form.Field name="usesPreset">
                    {(usesPresetField) => (
                      <form.Field name="usesCustom">
                        {(usesCustomField) => {
                          const mode = usesModeField.state.value;
                          const presetError = fieldErrorMessage(usesPresetField.state.meta.errors);
                          const customError = fieldErrorMessage(usesCustomField.state.meta.errors);
                          const error = mode === "custom" ? customError : presetError;
                          const usesLabel =
                            mode === "custom" ? t("inviteUsesCustom") : usesPresetField.state.value;
                          return (
                            <Field data-invalid={error ? true : undefined}>
                              <FieldLabel htmlFor="invite-uses">
                                {t("inviteUsesLabel")}
                                <span aria-hidden="true">*</span>
                              </FieldLabel>
                              <Select
                                value={mode === "custom" ? "custom" : usesPresetField.state.value}
                                onValueChange={(next) => {
                                  if (next == null) return;
                                  if (next === "custom") {
                                    usesModeField.handleChange("custom");
                                    focusUsesCustomAfterCloseRef.current = true;
                                    return;
                                  }
                                  usesModeField.handleChange("preset");
                                  usesPresetField.handleChange(next);
                                }}
                                onOpenChangeComplete={(isOpen) => {
                                  if (isOpen || !focusUsesCustomAfterCloseRef.current) return;
                                  focusUsesCustomAfterCloseRef.current = false;
                                  usesCustomInputRef.current?.focus();
                                }}
                              >
                                <SelectTrigger
                                  id="invite-uses"
                                  className="w-full"
                                  aria-invalid={error ? true : undefined}
                                >
                                  <SelectValue>{usesLabel}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {JOIN_CODE_USE_PRESETS.map((count) => (
                                      <SelectItem key={count} value={String(count)}>
                                        {count}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="custom">{t("inviteUsesCustom")}</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              {mode === "custom" ? (
                                <>
                                  <Input
                                    ref={usesCustomInputRef}
                                    id="invite-uses-custom"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={100}
                                    value={usesCustomField.state.value}
                                    onBlur={usesCustomField.handleBlur}
                                    onChange={(event) =>
                                      usesCustomField.handleChange(event.target.value)
                                    }
                                    aria-invalid={customError ? true : undefined}
                                    placeholder={t("inviteUsesCustomPlaceholder")}
                                    className="mt-2"
                                  />
                                  <FieldDescription>{t("inviteUsesCustomHint")}</FieldDescription>
                                </>
                              ) : null}
                              {error ? <FieldError>{error}</FieldError> : null}
                            </Field>
                          );
                        }}
                      </form.Field>
                    )}
                  </form.Field>
                )}
              </form.Field>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form="join-code-form" disabled={isSubmitting}>
                {isSubmitting ? tCommon("loading") : t("createInviteSubmit")}
              </Button>
            )}
          </form.Subscribe>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
