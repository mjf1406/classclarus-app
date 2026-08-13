import { useEffect, useMemo, useState } from "react";
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
const OUTPUT_ORDER = ["layout", "table"] as const;

export type SeatLayoutPrintMode = "current" | "select";
export type SeatChartPrintOutput = (typeof OUTPUT_ORDER)[number];

const DEFAULT_AVAILABLE_OUTPUTS: Array<SeatChartPrintOutput> = ["layout"];

export type SeatLayoutPrintSelection = {
  mode: SeatLayoutPrintMode;
  orientations: Array<SeatOrientation>;
  perPage: SeatsPrintPerPage;
  outputs: Array<SeatChartPrintOutput>;
};

function normalizeOutputs(
  outputs: ReadonlyArray<SeatChartPrintOutput>,
  available: ReadonlyArray<SeatChartPrintOutput>,
): Array<SeatChartPrintOutput> {
  return OUTPUT_ORDER.filter((output) => available.includes(output) && outputs.includes(output));
}

type SeatLayoutPrintCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrientation: SeatOrientation;
  onConfirm: (selection: SeatLayoutPrintSelection) => Promise<void>;
  /** Chart print can include a table; layout editor stays layout-only. */
  availableOutputs?: Array<SeatChartPrintOutput>;
  initialOutputs?: Array<SeatChartPrintOutput>;
};

export function SeatLayoutPrintCredenza({
  open,
  onOpenChange,
  currentOrientation,
  onConfirm,
  availableOutputs = DEFAULT_AVAILABLE_OUTPUTS,
  initialOutputs,
}: SeatLayoutPrintCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [mode, setMode] = useState<SeatLayoutPrintMode>("current");
  const [selected, setSelected] = useState<Array<SeatOrientation>>(ALL_ORIENTATIONS);
  const [perPage, setPerPage] = useState<SeatsPrintPerPage>(1);
  const [outputs, setOutputs] = useState<Array<SeatChartPrintOutput>>(() =>
    normalizeOutputs(initialOutputs ?? availableOutputs, availableOutputs),
  );
  const [errorKind, setErrorKind] = useState<"output" | "orientation" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowOutputPicker = availableOutputs.length > 1;
  const includeLayout = outputs.includes("layout");

  useEffect(() => {
    if (!open) return;
    setMode("current");
    setSelected(ALL_ORIENTATIONS);
    setPerPage(1);
    setOutputs(normalizeOutputs(initialOutputs ?? availableOutputs, availableOutputs));
    setErrorKind(null);
    setIsSubmitting(false);
  }, [open, availableOutputs, initialOutputs]);

  const orientationOk = !includeLayout || mode === "current" || selected.length > 0;
  const canSubmit = !isSubmitting && outputs.length > 0 && orientationOk;

  const outputLabels = useMemo(
    () =>
      ({
        layout: t("printOutputLayout"),
        table: t("printOutputTable"),
      }) satisfies Record<SeatChartPrintOutput, string>,
    [t],
  );

  const toggleOutput = (output: SeatChartPrintOutput, checked: boolean) => {
    setErrorKind(null);
    setOutputs((prev) => {
      if (checked) {
        if (prev.includes(output)) return prev;
        return normalizeOutputs([...prev, output], availableOutputs);
      }
      return prev.filter((value) => value !== output);
    });
  };

  const toggleOrientation = (orientation: SeatOrientation, checked: boolean) => {
    setErrorKind(null);
    setSelected((prev) => {
      if (checked) {
        if (prev.includes(orientation)) return prev;
        return ALL_ORIENTATIONS.filter((value) => value === orientation || prev.includes(value));
      }
      return prev.filter((value) => value !== orientation);
    });
  };

  const handleSubmit = async () => {
    if (outputs.length === 0) {
      setErrorKind("output");
      return;
    }
    if (includeLayout && mode === "select" && selected.length === 0) {
      setErrorKind("orientation");
      return;
    }
    if (!canSubmit) return;
    const selection: SeatLayoutPrintSelection = {
      mode,
      orientations: mode === "current" ? [currentOrientation] : selected,
      perPage: mode === "current" ? 1 : perPage,
      outputs,
    };
    setIsSubmitting(true);
    try {
      await onConfirm(selection);
      onOpenChange(false);
    } catch {
      setIsSubmitting(false);
    }
  };

  const outputError = errorKind === "output" ? t("printSelectNoneOutput") : null;
  const orientationError = errorKind === "orientation" ? t("printSelectNone") : null;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>
            {allowOutputPicker ? t("printOptionsTitleChart") : t("printOptionsTitle")}
          </CredenzaTitle>
          <CredenzaDescription>
            {allowOutputPicker ? t("printOptionsDescriptionChart") : t("printOptionsDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-5">
          {allowOutputPicker ? (
            <Field data-invalid={outputError ? true : undefined}>
              <FieldLabel>{t("printOutputLabel")}</FieldLabel>
              <div className="grid gap-2 pt-1">
                {availableOutputs.map((output) => {
                  const checked = outputs.includes(output);
                  return (
                    <label
                      key={output}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          toggleOutput(output, value === true);
                        }}
                      />
                      <span className="text-sm">{outputLabels[output]}</span>
                    </label>
                  );
                })}
              </div>
              {outputError ? <FieldError>{outputError}</FieldError> : null}
            </Field>
          ) : null}

          {includeLayout ? (
            <Field>
              <FieldLabel>{t("orientationLabel")}</FieldLabel>
              <RadioGroup
                value={mode}
                onValueChange={(value) => {
                  if (value === "current" || value === "select") {
                    setMode(value);
                    setErrorKind(null);
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
          ) : null}

          {includeLayout && mode === "select" ? (
            <>
              <Field data-invalid={orientationError ? true : undefined}>
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
                {orientationError ? <FieldError>{orientationError}</FieldError> : null}
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
