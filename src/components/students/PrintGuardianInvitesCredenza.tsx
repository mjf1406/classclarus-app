import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/i18n/LanguageSelect";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast-manager";
import { useCreateGuardianInvites } from "@/hooks/invitations/useCreateGuardianInvites";
import i18n, { ensureLocaleLoaded } from "@/i18n";
import { messageFromError } from "@/lib/errors/convexError";
import {
  guardianInvitePrintLogoAlt,
  printGuardianInviteSheets,
  toGuardianInviteSlips,
} from "@/lib/guardians/guardianInvitePrint";
import {
  GUARDIAN_INVITE_TTL_OPTIONS,
  GUARDIAN_INVITE_USE_PRESETS,
  printGuardianInvitesFormSchema,
  type GuardianInviteTtlOption,
  type PrintGuardianInvitesFormInput,
} from "@/lib/guardians/guardianInviteFormSchema";
import { isAppLanguage, type AppLanguage } from "@/lib/languages";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type PrintGuardianInvitesCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  students: Array<StudentRosterEntry>;
  nameFormat: RosterNameFormat;
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

function ttlLabelKey(
  option: GuardianInviteTtlOption,
): "inviteTtl1d" | "inviteTtl3d" | "inviteTtl7d" {
  switch (option) {
    case "1d":
      return "inviteTtl1d";
    case "3d":
      return "inviteTtl3d";
    case "7d":
      return "inviteTtl7d";
  }
}

export function PrintGuardianInvitesCredenza({
  open,
  onOpenChange,
  classId,
  students,
  nameFormat,
}: PrintGuardianInvitesCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const createMutation = useCreateGuardianInvites();
  const skipNextResetRef = useRef(false);

  const defaultLanguage: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";
  const singular = students.length === 1;

  const defaults = useMemo(
    (): PrintGuardianInvitesFormInput => ({
      ttlOption: "7d",
      usesPreset: "2",
      sheetLanguage: defaultLanguage,
    }),
    [defaultLanguage],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: printGuardianInvitesFormSchema,
    },
    onSubmit: async ({ value }) => {
      const parsed = printGuardianInvitesFormSchema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);

      const work = async () => {
        if (students.length === 0) {
          throw new Error(t("guardianInviteNoStudents"));
        }
        await ensureLocaleLoaded(parsed.sheetLanguage);
        const created = await createMutation.mutateAsync({
          classId,
          studentUserIds: students.map((student) => student.userId),
          ttlMs: parsed.ttlMs,
          maxUses: parsed.maxUses,
        });
        const namesByStudentId = new Map(
          students.map((student) => [
            student.userId,
            getRosterDisplayName(student, t("unnamedMember"), nameFormat),
          ]),
        );
        const slips = toGuardianInviteSlips(created, namesByStudentId, t("unnamedMember"));
        const tSheet = i18n.getFixedT(parsed.sheetLanguage, "classes");
        await printGuardianInviteSheets(slips, {
          documentTitle: tSheet(
            singular ? "printGuardianInviteTitle" : "printGuardianInvitesTitle",
          ),
          studentLabel: tSheet("guardianInviteSlipStudent"),
          codeLabel: tSheet("guardianInviteSlipCode"),
          expiresLabel: (date) => tSheet("guardianInviteSlipExpires", { date }),
          step1: tSheet("guardianInviteSlipStep1"),
          step2: tSheet("guardianInviteSlipStep2"),
          step3: tSheet("guardianInviteSlipStep3"),
          logoAlt: guardianInvitePrintLogoAlt(),
          lang: parsed.sheetLanguage,
        });
      };

      void toast.promise(work(), {
        loading: t("guardianInvitePrintPending"),
        success: t("guardianInvitePrintSuccess"),
        error: (error) =>
          messageFromError(error, t("guardianInvitePrintFailed"), tCommon("rateLimited")),
      });
    },
  });

  const resetForm = useCallback(
    (values: PrintGuardianInvitesFormInput) => {
      form.reset(values);
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
          <CredenzaTitle>
            {t(singular ? "printGuardianInviteTitle" : "printGuardianInvitesTitle")}
          </CredenzaTitle>
          <CredenzaDescription>
            {t(singular ? "printGuardianInviteDescription" : "printGuardianInvitesDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <CredenzaBody>
            <FieldGroup>
              <form.Field name="ttlOption">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="guardian-invite-ttl">{t("inviteTtlLabel")}</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next) => {
                          if (next === "1d" || next === "3d" || next === "7d") {
                            field.handleChange(next);
                          }
                        }}
                      >
                        <SelectTrigger
                          id="guardian-invite-ttl"
                          aria-invalid={error ? true : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GUARDIAN_INVITE_TTL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(ttlLabelKey(option.value))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="usesPreset">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="guardian-invite-uses">{t("inviteUsesLabel")}</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(next) => {
                          if (next != null) field.handleChange(next);
                        }}
                      >
                        <SelectTrigger
                          id="guardian-invite-uses"
                          aria-invalid={error ? true : undefined}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GUARDIAN_INVITE_USE_PRESETS.map((preset) => (
                            <SelectItem key={preset} value={String(preset)}>
                              {preset}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="sheetLanguage">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  const language = isAppLanguage(field.state.value)
                    ? field.state.value
                    : defaultLanguage;
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="guardian-invite-language">
                        {t("guardianInviteLanguageLabel")}
                      </FieldLabel>
                      <LanguageSelect
                        id="guardian-invite-language"
                        value={language}
                        onValueChange={field.handleChange}
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit">
              {t("guardianInvitePrintSubmit", { count: students.length })}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
