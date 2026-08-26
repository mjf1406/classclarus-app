import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  MAX_POINTS_BADGE_ALERT_ACTION_LENGTH,
  MAX_POINTS_BADGE_ALERT_COUNT,
  MAX_POINTS_BADGE_ALERTS,
  MIN_POINTS_BADGE_ALERT_COUNT,
  POINTS_BADGE_ALERT_EXAMPLE_COUNTS,
  type PointsBadgeAlert,
} from "../../../convex/lib/points/pointsBadgeAlert";
import { createPointsBadgeAlertItemSchema } from "../../../convex/lib/points/pointsBadgeAlertSchema";

const EXAMPLE_ACTION_KEYS = [
  "pointsBadgeAlertExampleWriteLetter",
  "pointsBadgeAlertExampleEmailParents",
  "pointsBadgeAlertExampleCallParents",
] as const;

type PointsBadgeCustomAlertsFieldProps = {
  idPrefix: string;
  alerts: PointsBadgeAlert[];
  disabled?: boolean;
  onChange: (alerts: PointsBadgeAlert[]) => void;
};

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function sortAlerts(alerts: PointsBadgeAlert[]): PointsBadgeAlert[] {
  return [...alerts].sort((a, b) => a.count - b.count);
}

export function PointsBadgeCustomAlertsField({
  idPrefix,
  alerts,
  disabled = false,
  onChange,
}: PointsBadgeCustomAlertsFieldProps) {
  const { t } = useTranslation("classes");
  const [addError, setAddError] = useState<string | null>(null);
  const atMax = alerts.length >= MAX_POINTS_BADGE_ALERTS;
  const usedCounts = useMemo(() => new Set(alerts.map((alert) => alert.count)), [alerts]);

  const schema = useMemo(
    () =>
      createPointsBadgeAlertItemSchema({
        countInvalid: t("pointsBadgeAlertsCountInvalid"),
        countRange: t("pointsBadgeAlertsCountRange", {
          min: MIN_POINTS_BADGE_ALERT_COUNT,
          max: MAX_POINTS_BADGE_ALERT_COUNT,
        }),
        actionRequired: t("pointsBadgeAlertsActionRequired"),
        actionTooLong: t("pointsBadgeAlertsActionTooLong", {
          max: MAX_POINTS_BADGE_ALERT_ACTION_LENGTH,
        }),
        duplicateCount: t("pointsBadgeAlertsDuplicateCount"),
        tooMany: t("pointsBadgeAlertsTooMany", { max: MAX_POINTS_BADGE_ALERTS }),
      }),
    [t],
  );

  const examples = POINTS_BADGE_ALERT_EXAMPLE_COUNTS.map((count, index) => ({
    count,
    action: t(EXAMPLE_ACTION_KEYS[index] ?? "pointsBadgeAlertExampleWriteLetter"),
  }));

  const form = useForm({
    defaultValues: {
      count: 3,
      action: "",
    },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      const parsed = schema.parse(value);
      if (atMax) {
        setAddError(t("pointsBadgeAlertsTooMany", { max: MAX_POINTS_BADGE_ALERTS }));
        return;
      }
      if (usedCounts.has(parsed.count)) {
        setAddError(t("pointsBadgeAlertsDuplicateCount"));
        return;
      }
      setAddError(null);
      onChange(sortAlerts([...alerts, parsed]));
      form.reset({ count: parsed.count, action: "" });
    },
  });

  const addExample = (example: PointsBadgeAlert) => {
    if (disabled || atMax || usedCounts.has(example.count)) return;
    setAddError(null);
    onChange(sortAlerts([...alerts, example]));
  };

  const removeAlert = (count: number) => {
    if (disabled) return;
    setAddError(null);
    onChange(alerts.filter((alert) => alert.count !== count));
  };

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>{t("pointsBadgeAlertsLabel")}</FieldLabel>
        <FieldDescription>{t("pointsBadgeAlertsDescription")}</FieldDescription>
      </Field>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("pointsBadgeAlertsExamplesLabel")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => {
            const alreadyAdded = usedCounts.has(example.count);
            return (
              <Button
                key={example.count}
                type="button"
                size="xs"
                variant="outline"
                disabled={disabled || atMax || alreadyAdded}
                onClick={() => addExample(example)}
              >
                {t("pointsBadgeAlertsExampleChip", {
                  count: example.count,
                  action: example.action,
                })}
              </Button>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li
              key={alert.count}
              className="flex items-start justify-between gap-2 rounded-xl border border-border px-3 py-2"
            >
              <p className="min-w-0 text-sm">
                <span className="font-medium tabular-nums">{alert.count}</span>
                <span className="text-muted-foreground"> — </span>
                <span>{alert.action}</span>
              </p>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={disabled}
                aria-label={t("pointsBadgeAlertsRemoveAria", { action: alert.action })}
                onClick={() => removeAlert(alert.count)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <form.Field name="count">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined} className="w-auto gap-1.5">
                  <FieldLabel htmlFor={`${idPrefix}-count`}>
                    {t("pointsBadgeAlertsCountLabel")}
                  </FieldLabel>
                  <NumberInput
                    id={`${idPrefix}-count`}
                    value={field.state.value}
                    min={MIN_POINTS_BADGE_ALERT_COUNT}
                    max={MAX_POINTS_BADGE_ALERT_COUNT}
                    disabled={disabled || atMax}
                    aria-label={t("pointsBadgeAlertsCountAria")}
                    aria-invalid={error ? true : undefined}
                    className="shrink-0"
                    onBlur={field.handleBlur}
                    onValueChange={(count) => {
                      setAddError(null);
                      field.handleChange(count);
                    }}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="action">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined} className="min-w-40 flex-1 gap-1.5">
                  <FieldLabel htmlFor={`${idPrefix}-action`}>
                    {t("pointsBadgeAlertsActionLabel")}
                  </FieldLabel>
                  <Input
                    id={`${idPrefix}-action`}
                    value={field.state.value}
                    maxLength={MAX_POINTS_BADGE_ALERT_ACTION_LENGTH}
                    disabled={disabled || atMax}
                    placeholder={t("pointsBadgeAlertsActionPlaceholder")}
                    aria-label={t("pointsBadgeAlertsActionAria")}
                    aria-invalid={error ? true : undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setAddError(null);
                      field.handleChange(event.target.value);
                    }}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>
          <Button type="submit" size="sm" disabled={disabled || atMax}>
            <PlusIcon data-icon="inline-start" />
            {t("pointsBadgeAlertsAdd")}
          </Button>
        </div>
        {addError ? <FieldError>{addError}</FieldError> : null}
      </form>
    </div>
  );
}
