import { useEffect, useState } from "react";
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
import { PasswordInput } from "@/components/ui/password-input";

const MIN_PASSWORD_LENGTH = 8;

type ResetPasswordCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onConfirm: (newPassword: string) => Promise<void>;
};

export function ResetPasswordCredenza({
  open,
  onOpenChange,
  email,
  onConfirm,
}: ResetPasswordCredenzaProps) {
  const { t } = useTranslation("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirmPassword("");
    setIsSubmitting(false);
    setErrors({});
  }, [open, email]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t("passwordTooShort");
    }
    if (password !== confirmPassword) {
      next.confirmPassword = t("passwordMismatch");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(password);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("resetTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("resetDescription", { email })}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <FieldGroup>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="admin-reset-password">{t("newPasswordLabel")}</FieldLabel>
              <PasswordInput
                id="admin-reset-password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={errors.password ? true : undefined}
                placeholder={t("newPasswordPlaceholder")}
              />
              {errors.password ? <FieldError>{errors.password}</FieldError> : null}
            </Field>
            <Field data-invalid={errors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor="admin-reset-confirm">{t("confirmPasswordLabel")}</FieldLabel>
              <PasswordInput
                id="admin-reset-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={errors.confirmPassword ? true : undefined}
                placeholder={t("confirmPasswordPlaceholder")}
              />
              {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
            </Field>
          </FieldGroup>
          <p className="mt-3 text-sm text-muted-foreground">{t("resetSessionsNote")}</p>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {t("resetSubmit")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
