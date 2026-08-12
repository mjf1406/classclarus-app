import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  ALL_EQUITABLE_GENDER_BUCKETS,
  formatEquitableGenderBucketLabel,
  normalizeEquitableGenderBuckets,
  type EquitableGenderBucket,
} from "@/lib/assigners/equitableAssigners";

type EquitableGenderBucketsFieldProps = {
  value: EquitableGenderBucket[];
  onChange: (next: EquitableGenderBucket[]) => void;
  disabled?: boolean;
  idPrefix?: string;
};

export function EquitableGenderBucketsField({
  value,
  onChange,
  disabled = false,
  idPrefix = "equitable-gender",
}: EquitableGenderBucketsFieldProps) {
  const { t } = useTranslation("assigners");
  const normalized = normalizeEquitableGenderBuckets(value);

  const toggle = (bucket: EquitableGenderBucket, checked: boolean) => {
    const set = new Set(normalized);
    if (checked) {
      set.add(bucket);
    } else {
      set.delete(bucket);
    }
    const next = ALL_EQUITABLE_GENDER_BUCKETS.filter((entry) => set.has(entry));
    onChange(next.length > 0 ? next : normalized);
  };

  return (
    <Field>
      <FieldLabel>{t("equitableGenderBucketsLabel")}</FieldLabel>
      <p className="text-sm text-muted-foreground">{t("equitableGenderBucketsHint")}</p>
      <div className="flex flex-col gap-2 pt-1">
        {ALL_EQUITABLE_GENDER_BUCKETS.map((bucket) => {
          const id = `${idPrefix}-${bucket}`;
          return (
            <div key={bucket} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={normalized.includes(bucket)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(bucket, checked === true)}
              />
              <FieldLabel htmlFor={id} className="font-normal">
                {formatEquitableGenderBucketLabel(bucket, t)}
              </FieldLabel>
            </div>
          );
        })}
      </div>
    </Field>
  );
}
