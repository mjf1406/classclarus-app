import type { TFunction } from "i18next";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PURCHASE_LIMIT_PERIODS,
  type PurchaseLimitFormValues,
  type PurchaseLimitPeriod,
} from "@/lib/rewards/purchaseLimit";

type PurchaseLimitFieldsProps = {
  t: TFunction<"rewards">;
  /** Tip variant: item supersedes folder, or folder only covers items without limits. */
  tipVariant: "item" | "folder";
  values: PurchaseLimitFormValues;
  onChange: (next: PurchaseLimitFormValues) => void;
  errors?: Partial<Record<"maxPurchases" | "every" | "period", string>>;
};

export function PurchaseLimitFields({
  t,
  tipVariant,
  values,
  onChange,
  errors,
}: PurchaseLimitFieldsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <FieldLabel htmlFor="purchase-limit-enabled">{t("purchaseLimitEnableLabel")}</FieldLabel>
          <FieldDescription>
            {tipVariant === "item" ? t("purchaseLimitItemTip") : t("purchaseLimitFolderTip")}
          </FieldDescription>
        </div>
        <Switch
          id="purchase-limit-enabled"
          checked={values.enabled}
          onCheckedChange={(checked) => onChange({ ...values, enabled: checked })}
        />
      </div>

      {values.enabled ? (
        <div className="flex flex-col gap-3">
          <Field data-invalid={errors?.maxPurchases ? true : undefined}>
            <FieldLabel htmlFor="purchase-limit-max">{t("purchaseLimitMaxLabel")}</FieldLabel>
            <Input
              id="purchase-limit-max"
              inputMode="numeric"
              value={values.maxPurchases}
              onChange={(event) => onChange({ ...values, maxPurchases: event.target.value })}
            />
            {errors?.maxPurchases ? <FieldError>{errors.maxPurchases}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel>{t("purchaseLimitTypeLabel")}</FieldLabel>
            <Input value={t("purchaseLimitTypeRecurring")} disabled readOnly />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={errors?.every ? true : undefined}>
              <FieldLabel htmlFor="purchase-limit-every">{t("purchaseLimitEveryLabel")}</FieldLabel>
              <Input
                id="purchase-limit-every"
                inputMode="numeric"
                value={values.every}
                onChange={(event) => onChange({ ...values, every: event.target.value })}
              />
              {errors?.every ? <FieldError>{errors.every}</FieldError> : null}
            </Field>

            <Field data-invalid={errors?.period ? true : undefined}>
              <FieldLabel>{t("purchaseLimitPeriodLabel")}</FieldLabel>
              <Select
                value={values.period}
                onValueChange={(next) => {
                  if (next == null) return;
                  if (!PURCHASE_LIMIT_PERIODS.includes(next as PurchaseLimitPeriod)) return;
                  onChange({ ...values, period: next as PurchaseLimitPeriod });
                }}
              >
                <SelectTrigger className="w-full" aria-label={t("purchaseLimitPeriodLabel")}>
                  <SelectValue>
                    {t(
                      `purchaseLimitPeriod_${values.period}` as
                        | "purchaseLimitPeriod_day"
                        | "purchaseLimitPeriod_week"
                        | "purchaseLimitPeriod_month",
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PURCHASE_LIMIT_PERIODS.map((period) => (
                      <SelectItem key={period} value={period}>
                        {t(
                          `purchaseLimitPeriod_${period}` as
                            | "purchaseLimitPeriod_day"
                            | "purchaseLimitPeriod_week"
                            | "purchaseLimitPeriod_month",
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors?.period ? <FieldError>{errors.period}</FieldError> : null}
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}
