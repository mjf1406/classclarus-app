import { useTranslation } from "react-i18next";

import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type SeatChartNameCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
};

export function SeatChartNameCredenza({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  onSubmit,
}: SeatChartNameCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
          if (next) {
            setName(initialName);
            setError(null);
          }
        }
      }}
    >
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{description}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="chart-name">{t("chartNameLabel")}</FieldLabel>
              <Input
                id="chart-name"
                aria-invalid={error ? true : undefined}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void (async () => {
                      const trimmed = name.trim();
                      if (!trimmed) {
                        setError(t("nameRequired"));
                        return;
                      }
                      setPending(true);
                      onOpenChange(false);
                      try {
                        await onSubmit(trimmed);
                      } catch (submitError) {
                        onOpenChange(true);
                        setError(
                          submitError instanceof Error ? submitError.message : t("chartSaveFailed"),
                        );
                      } finally {
                        setPending(false);
                      }
                    })();
                  }
                }}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </Field>
          </FieldGroup>
        </CredenzaBody>
        <CredenzaFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              void (async () => {
                const trimmed = name.trim();
                if (!trimmed) {
                  setError(t("nameRequired"));
                  return;
                }
                setPending(true);
                onOpenChange(false);
                try {
                  await onSubmit(trimmed);
                } catch (submitError) {
                  onOpenChange(true);
                  setError(
                    submitError instanceof Error ? submitError.message : t("chartSaveFailed"),
                  );
                } finally {
                  setPending(false);
                }
              })();
            }}
          >
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
