import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SEAT_ORIENTATION_LABEL_KEYS, type SeatOrientation } from "@/lib/assigners/seatLayouts";
import type { SeatsPrintPerPage } from "@/lib/assigners/seatsPrint";

const ALL_ORIENTATIONS: Array<SeatOrientation> = ["front", "back", "left", "right"];
const PER_PAGE_OPTIONS: Array<SeatsPrintPerPage> = [1, 2, 4];

export type SeatLayoutPrintMode = "current" | "select";

export type SeatLayoutPrintSelection = {
  mode: SeatLayoutPrintMode;
  orientations: Array<SeatOrientation>;
  perPage: SeatsPrintPerPage;
};

type SeatLayoutPrintCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrientation: SeatOrientation;
  onConfirm: (selection: SeatLayoutPrintSelection) => Promise<void>;
};

export function SeatLayoutPrintCredenza({
  open,
  onOpenChange,
  currentOrientation,
  onConfirm,
}: SeatLayoutPrintCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [mode, setMode] = useState<SeatLayoutPrintMode>("current");
  const [selected, setSelected] = useState<Array<SeatOrientation>>(ALL_ORIENTATIONS);
  const [perPage, setPerPage] = useState<SeatsPrintPerPage>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("current");
    setSelected(ALL_ORIENTATIONS);
    setPerPage(1);
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const canSubmit = !isSubmitting && (mode === "current" || selected.length > 0);

  const toggleOrientation = (orientation: SeatOrientation, checked: boolean) => {
    setError(null);
    setSelected((prev) => {
      if (checked) {
        if (prev.includes(orientation)) return prev;
        return ALL_ORIENTATIONS.filter((value) => value === orientation || prev.includes(value));
      }
      return prev.filter((value) => value !== orientation);
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (mode === "select" && selected.length === 0) {
      setError(t("printSelectNone"));
      return;
    }
    const selection: SeatLayoutPrintSelection = {
      mode,
      orientations: mode === "current" ? [currentOrientation] : selected,
      perPage: mode === "current" ? 1 : perPage,
    };
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(selection);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("printOptionsTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("printOptionsDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-5">
          <Field>
            <FieldLabel>{t("orientationLabel")}</FieldLabel>
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                if (value === "current" || value === "select") {
                  setMode(value);
                  setError(null);
                }
              }}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
                <RadioGroupItem value="current" />
                <span className="text-sm">
                  {t("printModeCurrent")} ({t(SEAT_ORIENTATION_LABEL_KEYS[currentOrientation])})
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
                <RadioGroupItem value="select" />
                <span className="text-sm">{t("printModeSelect")}</span>
              </label>
            </RadioGroup>
          </Field>

          {mode === "select" ? (
            <>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel>{t("printModeSelect")}</FieldLabel>
                <div className="grid gap-2 pt-1">
                  {ALL_ORIENTATIONS.map((orientation) => {
                    const checked = selected.includes(orientation);
                    return (
                      <label
                        key={orientation}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            toggleOrientation(orientation, value === true);
                          }}
                        />
                        <span className="text-sm">
                          {t(SEAT_ORIENTATION_LABEL_KEYS[orientation])}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel>{t("printPerPageLabel")}</FieldLabel>
                <RadioGroup
                  value={String(perPage)}
                  onValueChange={(value) => {
                    if (value === "1" || value === "2" || value === "4") {
                      setPerPage(Number(value) as SeatsPrintPerPage);
                    }
                  }}
                  className="gap-2"
                >
                  {PER_PAGE_OPTIONS.map((count) => (
                    <label
                      key={count}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5"
                    >
                      <RadioGroupItem value={String(count)} />
                      <span className="text-sm">{t("printPerPageOption", { count })}</span>
                    </label>
                  ))}
                </RadioGroup>
              </Field>
            </>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {t("printExportAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
