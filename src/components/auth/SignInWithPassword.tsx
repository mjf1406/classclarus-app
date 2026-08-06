import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  fullNameFromParts,
  passwordSignInSchema,
  passwordSignUpSchema,
} from "@/lib/auth/authPassword";
import { getSafeAuthRedirect } from "@/lib/auth/authRedirect";

interface SignInWithPasswordProps {
  termsAccepted?: boolean;
  redirectTo?: string;
}

type Flow = "signIn" | "signUp";

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  form?: string;
};

export function SignInWithPassword({ termsAccepted = false, redirectTo }: SignInWithPasswordProps) {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const { t } = useTranslation(["auth", "common"]);
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    if (flow === "signIn") {
      const result = passwordSignInSchema.safeParse({ email, password });
      if (!result.success) {
        const next: FieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "email") next.email = t("invalidEmail");
          if (key === "password") next.password = t("passwordTooShort");
        }
        setErrors(next);
        return false;
      }
    } else {
      const result = passwordSignUpSchema.safeParse({
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
      });
      if (!result.success) {
        const next: FieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "email") next.email = t("invalidEmail");
          if (key === "password") next.password = t("passwordTooShort");
          if (key === "firstName") next.firstName = t("nameRequired");
          if (key === "lastName") next.lastName = t("nameRequired");
          if (key === "confirmPassword") {
            next.confirmPassword =
              issue.message === "mismatch" ? t("passwordsDoNotMatch") : t("passwordTooShort");
          }
        }
        setErrors(next);
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!termsAccepted || isLoading) return;
    if (!validate()) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.set("email", email.trim());
    formData.set("password", password);
    formData.set("flow", flow);
    if (flow === "signUp") {
      const first = firstName.trim();
      const last = lastName.trim();
      formData.set("firstName", first);
      formData.set("lastName", last);
      // Also send combined name for providers/tools that only read `name`.
      formData.set("name", fullNameFromParts(first, last));
    }
    void signIn("password", formData)
      .then(async () => {
        await navigate({ href: getSafeAuthRedirect(redirectTo) });
      })
      .catch(() => {
        setErrors({ form: t("authFailed") });
        setIsLoading(false);
      });
  };

  const switchFlow = () => {
    setFlow((prev) => (prev === "signIn" ? "signUp" : "signIn"));
    setErrors({});
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FieldGroup className="gap-4">
        {flow === "signUp" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.firstName ? true : undefined}>
              <FieldLabel htmlFor="auth-first-name">{t("firstNameLabel")}</FieldLabel>
              <Input
                id="auth-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                aria-invalid={errors.firstName ? true : undefined}
                placeholder={t("firstNamePlaceholder")}
              />
              {errors.firstName ? <FieldError>{errors.firstName}</FieldError> : null}
            </Field>
            <Field data-invalid={errors.lastName ? true : undefined}>
              <FieldLabel htmlFor="auth-last-name">{t("lastNameLabel")}</FieldLabel>
              <Input
                id="auth-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                aria-invalid={errors.lastName ? true : undefined}
                placeholder={t("lastNamePlaceholder")}
              />
              {errors.lastName ? <FieldError>{errors.lastName}</FieldError> : null}
            </Field>
          </div>
        ) : null}
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="auth-email">{t("emailLabel")}</FieldLabel>
          <Input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            aria-invalid={errors.email ? true : undefined}
            placeholder={t("emailPlaceholder")}
          />
          {errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </Field>
        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="auth-password">{t("passwordLabel")}</FieldLabel>
          <PasswordInput
            id="auth-password"
            name="password"
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            aria-invalid={errors.password ? true : undefined}
            placeholder={t("passwordPlaceholder")}
          />
          {errors.password ? <FieldError>{errors.password}</FieldError> : null}
        </Field>
        {flow === "signUp" ? (
          <Field data-invalid={errors.confirmPassword ? true : undefined}>
            <FieldLabel htmlFor="auth-confirm-password">{t("confirmPasswordLabel")}</FieldLabel>
            <PasswordInput
              id="auth-confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              aria-invalid={errors.confirmPassword ? true : undefined}
              placeholder={t("confirmPasswordPlaceholder")}
            />
            {errors.confirmPassword ? <FieldError>{errors.confirmPassword}</FieldError> : null}
          </Field>
        ) : null}
      </FieldGroup>

      {errors.form ? (
        <p className="text-sm text-destructive" role="alert">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={!termsAccepted || isLoading}>
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : flow === "signIn" ? (
          t("signInWithPassword")
        ) : (
          t("signUpWithPassword")
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={isLoading}
        onClick={switchFlow}
      >
        {flow === "signIn" ? t("signUpInstead") : t("signInInstead")}
      </Button>
    </form>
  );
}
