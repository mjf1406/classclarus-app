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

type DeleteNamedCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

export function DeleteNamedCredenza({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: DeleteNamedCredenzaProps) {
  const { t: tCommon } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setIsSubmitting(false);
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
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{description}</CredenzaDescription>
        </CredenzaHeader>
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
            {confirmLabel}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
