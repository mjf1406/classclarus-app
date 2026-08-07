import { useTranslation } from "react-i18next";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatRosterNameParts, type RosterNameFormat } from "@/lib/roster/roster";
import { cn } from "@/lib/utils";

type RosterNameFormatControlsProps = {
  value: RosterNameFormat;
  onChange: (next: RosterNameFormat) => void;
  disabled?: boolean;
  /** `card` = settings page fields; `inline` = students toolbar. */
  variant?: "card" | "inline";
  className?: string;
};

export function RosterNameFormatControls({
  value,
  onChange,
  disabled = false,
  variant = "card",
  className,
}: RosterNameFormatControlsProps) {
  const { t } = useTranslation("classes");
  const preview = formatRosterNameParts(
    t("rosterNameFormatPreviewSampleFirst"),
    t("rosterNameFormatPreviewSampleLast"),
    value,
  );

  const orderControl = (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value.order]}
      disabled={disabled}
      onValueChange={(values) => {
        const next = values[0];
        if (next === "firstLast" || next === "lastFirst") {
          onChange({ ...value, order: next });
        }
      }}
    >
      <ToggleGroupItem value="firstLast" aria-label={t("rosterNameOrderFirstLast")}>
        {t("rosterNameOrderFirstLast")}
      </ToggleGroupItem>
      <ToggleGroupItem value="lastFirst" aria-label={t("rosterNameOrderLastFirst")}>
        {t("rosterNameOrderLastFirst")}
      </ToggleGroupItem>
    </ToggleGroup>
  );

  const spaceControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="roster-name-space"
        checked={value.space}
        disabled={disabled}
        onCheckedChange={(checked) => onChange({ ...value, space: checked })}
      />
      <FieldLabel htmlFor="roster-name-space" className="font-normal">
        {t("rosterNameSpaceLabel")}
      </FieldLabel>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        {orderControl}
        {spaceControl}
        {preview ? (
          <span className="text-xs text-muted-foreground">
            {t("rosterNameFormatPreview", { name: preview })}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field>
        <FieldLabel>{t("rosterNameOrderLabel")}</FieldLabel>
        <FieldDescription>{t("rosterNameOrderDescription")}</FieldDescription>
        {orderControl}
      </Field>
      <Field>
        <FieldDescription>{t("rosterNameSpaceDescription")}</FieldDescription>
        {spaceControl}
      </Field>
      {preview ? (
        <p className="text-sm text-muted-foreground">
          {t("rosterNameFormatPreview", { name: preview })}
        </p>
      ) : null}
    </div>
  );
}
