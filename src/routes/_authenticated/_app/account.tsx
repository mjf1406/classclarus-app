import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import { BillingSummaryCard } from "@/components/account/BillingSummaryCard";
import { DangerZoneCard } from "@/components/account/DangerZoneCard";
import { ProfileCard } from "@/components/account/ProfileCard";
import { SecurityCard } from "@/components/account/SecurityCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentSession } from "@/hooks/user/useCurrentSession";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";

export const Route = createFileRoute("/_authenticated/_app/account")({
  component: function AccountPage() {
    const { t } = useTranslation("account");
    const { t: tCommon } = useTranslation("common");
    const { t: tAuth } = useTranslation("auth");
    const sessionQuery = useCurrentSession();
    const userQuery = useCurrentUser();
    const { signOut } = useAuthActions();
    const navigate = useNavigate();

    const isSessionExpired =
      sessionQuery.data?.expirationTime !== undefined &&
      sessionQuery.data.expirationTime <= Date.now();

    const handleSignOut = async () => {
      await signOut();
      await navigate({ to: "/login" });
    };

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
        {isSessionExpired && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="text-destructive" />
                {tCommon("signIn")}
              </CardTitle>
              <CardDescription>{tAuth("signInToContinue")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                className="w-full"
                size="lg"
                nativeButton={false}
                render={<Link to="/login" />}
              >
                {tCommon("signIn")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <ProfileCard user={userQuery.data} isPending={userQuery.isPending} />
        <SecurityCard
          providers={userQuery.data?.providers}
          isPending={userQuery.isPending}
          onSignOut={handleSignOut}
        />
        <BillingSummaryCard />
        <DangerZoneCard email={userQuery.data?.email} />
      </div>
    );
  },
});
