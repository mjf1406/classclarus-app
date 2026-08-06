import { useState } from "react";
import { LogOut, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOutOtherSessions } from "@/hooks/user/useSignOutOtherSessions";
import { providerDisplayName } from "@/lib/account/accountHelpers";

type SecurityCardProps = {
  providers: Array<string> | undefined;
  isPending: boolean;
  onSignOut: () => Promise<void>;
};

export function SecurityCard({ providers, isPending, onSignOut }: SecurityCardProps) {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const signOutOther = useSignOutOtherSessions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("securityTitle")}</CardTitle>
        <CardDescription>{t("securityDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("linkedProvidersTitle")}</p>
          {isPending ? (
            <Skeleton className="h-8 w-28" />
          ) : providers && providers.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <li key={provider}>
                  <Badge variant="secondary">{providerDisplayName(provider)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("linkedProvidersEmpty")}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <AsyncButton
            type="button"
            variant="outline"
            className="w-full justify-center sm:w-auto"
            onClick={async () => {
              await onSignOut();
            }}
          >
            <LogOut data-icon="inline-start" />
            {tCommon("signOut")}
          </AsyncButton>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center sm:w-auto"
            onClick={() => setConfirmOpen(true)}
          >
            <ShieldOff data-icon="inline-start" />
            {t("signOutOtherDevices")}
          </Button>
        </div>
      </CardContent>

      <Credenza open={confirmOpen} onOpenChange={setConfirmOpen}>
        <CredenzaContent className="sm:max-w-md">
          <CredenzaHeader>
            <CredenzaTitle>{t("signOutOtherConfirmTitle")}</CredenzaTitle>
            <CredenzaDescription>{t("signOutOtherConfirmDescription")}</CredenzaDescription>
          </CredenzaHeader>
          <CredenzaBody>
            <p className="text-sm text-muted-foreground">{t("signOutOtherConfirmBody")}</p>
          </CredenzaBody>
          <CredenzaFooter className="flex-row justify-between gap-2">
            <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
              {t("cancel")}
            </CredenzaClose>
            <AsyncButton
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                await signOutOther.mutateAsync();
                setConfirmOpen(false);
              }}
            >
              {t("signOutOtherConfirmSubmit")}
            </AsyncButton>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>
    </Card>
  );
}
