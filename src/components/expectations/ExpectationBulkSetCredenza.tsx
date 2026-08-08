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
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ExpectationBulkOperation,
  ExpectationListItem,
} from "@/lib/expectations/expectations";

type ExpectationBulkSetCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectation: ExpectationListItem | null;
  studentCount: number;
  onSubmit: (args: {
    operation: ExpectationBulkOperation;
    numberValue?: number;
    rangeMin?: number;
    rangeMax?: number;
  }) => Promise<void>;
};

const OPERATIONS: ExpectationBulkOperation[] = [
  "set",
  "increaseBy",
  "decreaseBy",
  "increasePercent",
  "decreasePercent",
];

export function ExpectationBulkSetCredenza({
  open,
  onOpenChange,
  expectation,
  studentCount,
  onSubmit,
}: ExpectationBulkSetCredenzaProps) {
  const { t } = useTranslation("expectations");
  const [operation, setOperation] = useState<ExpectationBulkOperation>("set");
  const [numberValue, setNumberValue] = useState(0);
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOperation("set");
    setNumberValue(0);
    setRangeMin(0);
    setRangeMax(0);
    setError(null);
    setSubmitError(null);
  }, [open, expectation?._id]);

  if (!expectation) return null;

  const operationLabel = (op: ExpectationBulkOperation) => {
    switch (op) {
      case "set":
        return t("bulkOperationSet");
      case "increaseBy":
        return t("bulkOperationIncreaseBy");
      case "decreaseBy":
        return t("bulkOperationDecreaseBy");
      case "increasePercent":
        return t("bulkOperationIncreasePercent");
      case "decreasePercent":
        return t("bulkOperationDecreasePercent");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitError(null);

    if (operation === "set" && expectation.inputType === "numberRange") {
      if (rangeMin > rangeMax) {
        setError(t("rangeOrderInvalid"));
        return;
      }
      onOpenChange(false);
      try {
        await onSubmit({ operation, rangeMin, rangeMax });
      } catch (err) {
        onOpenChange(true);
        setSubmitError(err instanceof Error ? err.message : t("bulkFailed"));
      }
      return;
    }

    onOpenChange(false);
    try {
      await onSubmit({ operation, numberValue });
    } catch (err) {
      onOpenChange(true);
      setSubmitError(err instanceof Error ? err.message : t("bulkFailed"));
    }
  };

  const showRangeSet = operation === "set" && expectation.inputType === "numberRange";

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-lg">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{t("bulkTitle", { name: expectation.name })}</CredenzaTitle>
          <CredenzaDescription>{t("bulkDescription", { count: studentCount })}</CredenzaDescription>
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleSubmit();
          }}
        >
          <CredenzaBody className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <FieldGroup>
              <Field>
                <FieldLabel>{t("bulkOperationLabel")}</FieldLabel>
                <Select
                  value={operation}
                  onValueChange={(next) => {
                    if (!next || !OPERATIONS.includes(next as ExpectationBulkOperation)) return;
                    setOperation(next as ExpectationBulkOperation);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label={t("bulkOperationLabel")}>
                    <SelectValue>{operationLabel(operation)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPERATIONS.map((op) => (
                        <SelectItem key={op} value={op}>
                          {operationLabel(op)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {showRangeSet ? (
                <div className="flex flex-wrap gap-3">
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="bulk-expectation-min">
                      {t("bulkRangeMinLabel", { unit: expectation.unit })}
                    </FieldLabel>
                    <NumberInput
                      id="bulk-expectation-min"
                      value={rangeMin}
                      onValueChange={setRangeMin}
                    />
                  </Field>
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="bulk-expectation-max">
                      {t("bulkRangeMaxLabel", { unit: expectation.unit })}
                    </FieldLabel>
                    <NumberInput
                      id="bulk-expectation-max"
                      value={rangeMax}
                      onValueChange={setRangeMax}
                    />
                  </Field>
                </div>
              ) : (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="bulk-expectation-value">
                    {operation === "increasePercent" || operation === "decreasePercent"
                      ? t("bulkValueLabel")
                      : t("bulkValueLabelWithUnit", { unit: expectation.unit })}
                  </FieldLabel>
                  <NumberInput
                    id="bulk-expectation-value"
                    value={numberValue}
                    onValueChange={setNumberValue}
                  />
                </Field>
              )}
              {error ? <FieldError>{error}</FieldError> : null}
              <p className="text-sm text-muted-foreground">
                {operation === "set" ? t("bulkSetHint") : t("bulkAdjustHint")}
              </p>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 flex-row gap-2 sm:justify-between">
            <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit" className="flex-1">
              {t("bulkSubmit", { count: studentCount })}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
