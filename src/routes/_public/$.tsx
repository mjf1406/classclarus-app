import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { RouteErrorCard } from "@/components/errors/RouteErrorCard";

export const Route = createFileRoute("/_public/$")({
  component: function NotFound() {
    const { t } = useTranslation("common");

    return (
      <RouteErrorCard
        icon="notFound"
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
        imageSrc="/brand/error/404.webp"
        imageAlt={t("notFoundTitle")}
        primaryAction={{
          label: t("goBack"),
          onClick: () => {
            window.history.back();
          },
        }}
        secondaryAction={{
          label: t("goHome"),
          to: "/",
        }}
      />
    );
  },
});
