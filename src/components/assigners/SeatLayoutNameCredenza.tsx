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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const MAX_NAME = 80;

type SeatLayoutNameCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
};

export function SeatLayoutNameCredenza({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  onSubmit,
}: SeatLayoutNameCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, initialName]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameRequired"));
      return;
    }
    if (trimmed.length > MAX_NAME) {
      setError(t("nameTooLong", { max: MAX_NAME }));
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onSubmit(trimmed);
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
        <CredenzaBody>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="seat-layout-name">{t("nameLabel")}</FieldLabel>
              <Input
                id="seat-layout-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                autoFocus
                maxLength={MAX_NAME}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
          </FieldGroup>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
