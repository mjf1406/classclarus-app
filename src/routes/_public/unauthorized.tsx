import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { APP_CONFIG } from "@/config/app";

export const Route = createFileRoute("/_public/unauthorized")({
  component: function UnauthorizedUser() {
    const { t } = useTranslation("common");

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <ImageSkeleton
                src="/brand/error/403.webp"
                alt={t("unauthorizedTitle")}
                width={327}
                height={341}
              />
            </div>
            <div>
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <AlertTriangle className="text-destructive" />
                {t("unauthorizedTitle")}
              </CardTitle>
              <CardDescription className="mt-2">{t("unauthorizedDescription")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("unauthorizedBody")}</p>
            <Button
              variant="default"
              className="w-full"
              size="lg"
              nativeButton={false}
              render={<Link to="/" />}
            >
              {t("goHome")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              nativeButton={false}
              render={<a href={APP_CONFIG.marketingUrl} />}
            >
              {t("unauthorizedLearnMore")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  },
});
