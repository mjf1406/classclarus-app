import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import type { PointsApplyMode } from "@/lib/rewards/rewards";

type RewardPointsApplyCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseCount: number;
  onConfirm: (mode: PointsApplyMode) => Promise<void>;
};

export function RewardPointsApplyCredenza({
  open,
  onOpenChange,
  purchaseCount,
  onConfirm,
}: RewardPointsApplyCredenzaProps) {
  const { t } = useTranslation("rewards");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setIsSubmitting(false);
  }, [open]);

  const confirm = async (mode: PointsApplyMode) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(mode);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("pointsApplyTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {t("pointsApplyDescription", { count: purchaseCount })}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              void confirm("future");
            }}
          >
            {t("pointsApplyFuture")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              void confirm("retroactive");
            }}
          >
            {t("pointsApplyRetroactive")}
          </Button>
          <CredenzaClose render={<Button type="button" variant="outline" className="w-full" />}>
            {t("cancel")}
          </CredenzaClose>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
