import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { RouteErrorCard } from "@/components/errors/RouteErrorCard";

export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation("common");
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorCard
      title={t("errorTitle")}
      description={t("errorDescription")}
      imageSrc="/brand/error/404.webp"
      imageAlt={t("errorTitle")}
      primaryAction={{
        label: t("tryAgain"),
        onClick: () => {
          reset();
          void router.invalidate();
        },
      }}
      secondaryAction={{
        label: t("goHome"),
        to: "/",
      }}
      tertiaryAction={{
        label: t("goBack"),
        onClick: () => {
          window.history.back();
        },
      }}
    />
  );
}
