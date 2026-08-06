import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { getSafeAuthRedirect } from "@/lib/auth/authRedirect";

interface SignInProps {
  termsAccepted?: boolean;
  redirectTo?: string;
}

export function SignInWithGoogle({ termsAccepted = false, redirectTo }: SignInProps) {
  const { signIn } = useAuthActions();
  const { t } = useTranslation("auth");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = () => {
    if (!termsAccepted) return;
    setIsLoading(true);

    const safeRedirectTo = getSafeAuthRedirect(redirectTo);
    signIn("google", { redirectTo: safeRedirectTo }).catch(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="flex w-full justify-center">
      <Button
        onClick={handleSignIn}
        disabled={!termsAccepted || isLoading}
        variant="outline"
        className={
          isLoading
            ? "relative overflow-hidden p-0"
            : "relative cursor-pointer rounded-none border-0 bg-transparent! p-0 hover:bg-transparent! disabled:cursor-not-allowed disabled:opacity-50 dark:border-0 dark:bg-transparent! dark:hover:bg-transparent!"
        }
        aria-label={t("signInWithGoogle")}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6! w-6! animate-spin text-muted-foreground" />
          </div>
        )}

        <img
          src="/google/light_sign_in.png"
          alt={t("signInWithGoogle")}
          className={`dark:hidden ${isLoading ? "invisible" : ""}`}
        />
        <img
          src="/google/dark_sign_in.png"
          alt={t("signInWithGoogle")}
          className={`hidden dark:block ${isLoading ? "invisible" : ""}`}
        />
      </Button>
    </div>
  );
}
