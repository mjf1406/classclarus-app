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

type RemoveMemberCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  onConfirm: () => Promise<void>;
};

export function RemoveMemberCredenza({
  open,
  onOpenChange,
  memberName,
  onConfirm,
}: RemoveMemberCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm();
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("removeMemberConfirmTitle", { name: memberName })}</CredenzaTitle>
          <CredenzaDescription>
            {t("removeMemberConfirmDescription", { name: memberName })}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t("removeMemberConfirmBody", { name: memberName })}
          </p>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {tCommon("goBack")}
          </CredenzaClose>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t("removeMember")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
