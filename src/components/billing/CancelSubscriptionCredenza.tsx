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
import { useCancelSubscription } from "@/hooks/billing/useCancelSubscription";

type CancelSubscriptionCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessUntil: string | null;
};

export function CancelSubscriptionCredenza({
  open,
  onOpenChange,
  accessUntil,
}: CancelSubscriptionCredenzaProps) {
  const { t } = useTranslation("billing");
  const { t: tCommon } = useTranslation("common");
  const cancelSubscription = useCancelSubscription();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (isSubmitting || cancelSubscription.isPending) {
      return;
    }
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await cancelSubscription.mutateAsync({ revokeImmediately: false });
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("cancelConfirmTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("cancelConfirmDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("cancelConfirmBody")}</p>
          {accessUntil ? (
            <p className="text-sm text-muted-foreground">
              {t("cancelConfirmAccessUntil", { date: accessUntil })}
            </p>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {tCommon("goBack")}
          </CredenzaClose>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={isSubmitting || cancelSubscription.isPending}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t("cancelConfirmSubmit")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
