import { useState } from "react";
import type { FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { passwordSignInSchema, passwordSignUpSchema } from "@/lib/authPassword";
import { getSafeAuthRedirect } from "@/lib/authRedirect";

interface SignInWithPasswordProps {
  termsAccepted?: boolean;
  redirectTo?: string;
}

type Flow = "signIn" | "signUp";

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  form?: string;
};

export function SignInWithPassword({ termsAccepted = false, redirectTo }: SignInWithPasswordProps) {
  const { signIn } = useAuthActions();
  const { t } = useTranslation(["auth", "common"]);
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
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
        name: name.trim() || undefined,
      });
      if (!result.success) {
        const next: FieldErrors = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "email") next.email = t("invalidEmail");
          if (key === "password") next.password = t("passwordTooShort");
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
    if (flow === "signUp" && name.trim()) {
      formData.set("name", name.trim());
    }
    // redirectTo is ignored for credentials flows but kept for API symmetry
    void getSafeAuthRedirect(redirectTo);

    void signIn("password", formData)
      .then(() => {
        // Session established — RequireAuth redirects away from /login
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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FieldGroup className="gap-4">
        {flow === "signUp" ? (
          <Field>
            <FieldLabel htmlFor="auth-name">{t("nameLabel")}</FieldLabel>
            <Input
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              placeholder={t("namePlaceholder")}
            />
          </Field>
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
          <Input
            id="auth-password"
            name="password"
            type="password"
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
            <Input
              id="auth-confirm-password"
              name="confirmPassword"
              type="password"
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
