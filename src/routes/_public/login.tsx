import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { LogoBig } from "@/components/brand/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SignInWithGoogle } from "@/components/auth/SignInWithGoogle";
import { SignInWithPassword } from "@/components/auth/SignInWithPassword";
import { isPasswordAuthEnabled } from "@/lib/authPassword";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/_public/login")({
  validateSearch: loginSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { redirect } = Route.useSearch();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { t } = useTranslation(["auth", "common"]);
  const passwordEnabled = isPasswordAuthEnabled();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md bg-input/30">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoBig />
          </div>
          <div>
            <CardTitle className="text-2xl">{t("welcomeTitle")}</CardTitle>
            <CardDescription className="mt-2">
              {t("signInToContinue")}{" "}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {t("learnMore")}
              </a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 mt-8">
          <div className="flex items-start space-x-2 pb-2">
            <Checkbox
              id="terms-acceptance"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5 bg-background"
            />
            <label
              htmlFor="terms-acceptance"
              className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
            >
              {t("agreePrefix")}{" "}
              <a
                href="https://www.classclarus.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t("privacyPolicy")}
              </a>
              ,{" "}
              <a
                href="https://www.classclarus.com/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t("termsAndConditions")}
              </a>
              , {t("and")}{" "}
              <a
                href="https://www.classclarus.com/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t("cookiePolicy")}
              </a>
              .
            </label>
          </div>
          {passwordEnabled ? (
            <SignInWithPassword termsAccepted={termsAccepted} redirectTo={redirect} />
          ) : (
            <SignInWithGoogle termsAccepted={termsAccepted} redirectTo={redirect} />
          )}
          <p className="opacity-50 text-sm">
            {passwordEnabled ? t("passwordAuthNote") : t("googleOnlyNote")}
          </p>
          <div className="pt-4 mt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              {t("appFooter")}{" "}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {t("learnMore")}
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
