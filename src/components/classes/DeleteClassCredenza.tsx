import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

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
import { deleteConfirmationPhrase } from "@/lib/classes/classFormSchema";

type DeleteClassCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  onConfirm: (confirmation: string) => Promise<void>;
};

export function DeleteClassCredenza({
  open,
  onOpenChange,
  className,
  onConfirm,
}: DeleteClassCredenzaProps) {
  const { t } = useTranslation("classes");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expected = deleteConfirmationPhrase(className);
  const canDelete = confirmation === expected && !isSubmitting;

  useEffect(() => {
    if (!open) return;
    setConfirmation("");
    setIsSubmitting(false);
  }, [open, className]);

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
          <CredenzaTitle>{t("deleteTitle")}</CredenzaTitle>
          <CredenzaDescription className="sr-only">{t("deleteDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <Trans
              ns="classes"
              i18nKey="deleteWarning"
              values={{ name: className }}
              components={{
                bold: <span className="font-semibold text-foreground" />,
              }}
            />
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>{t("deleteBulletMembers")}</li>
            <li>{t("deleteBulletSettings")}</li>
            <li>{t("deleteBulletContent")}</li>
          </ul>
          <p className="text-sm text-muted-foreground">{t("deletePermanentNote")}</p>

          <Field>
            <FieldLabel
              htmlFor="delete-class-confirmation"
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
              id="delete-class-confirmation"
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
