import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { accountDeleteConfirmationPhrase } from "@/lib/account/accountHelpers";

type DeleteAccountCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | null | undefined;
  onConfirm: (confirmation: string) => Promise<void>;
};

export function DeleteAccountCredenza({
  open,
  onOpenChange,
  email,
  onConfirm,
}: DeleteAccountCredenzaProps) {
  const { t } = useTranslation("account");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expected = accountDeleteConfirmationPhrase(email);
  const canDelete = confirmation === expected && !isSubmitting;

  useEffect(() => {
    if (!open) return;
    setConfirmation("");
    setIsSubmitting(false);
  }, [open, email]);

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(expected);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("deleteConfirmTitle")}</CredenzaTitle>
          <CredenzaDescription className="sr-only">
            {t("deleteConfirmDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("deleteWarning")}</p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>{t("deleteBulletProfile")}</li>
            <li>{t("deleteBulletMemberships")}</li>
            <li>{t("deleteBulletSessions")}</li>
          </ul>
          <p className="text-sm text-muted-foreground">{t("deletePermanentNote")}</p>

          <Field>
            <FieldLabel
              htmlFor="delete-account-confirmation"
              className="flex flex-wrap items-center gap-2"
            >
              <span>{t("deleteTypePrefix")}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {expected}
                <CopyButton
                  type="text"
                  value={expected}
                  className="size-6"
                  aria-label={t("copyConfirmation")}
                />
              </span>
              <span>{t("deleteTypeSuffix")}</span>
            </FieldLabel>
            <Input
              id="delete-account-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={expected}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            variant="destructive"
            className="flex-1 bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={!canDelete}
            onClick={() => {
              void handleDelete();
            }}
          >
            {t("deleteSubmit")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
