import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type ReleaseMode } from "@/lib/release/release";

const RELEASE_MODES = ["released", "hidden", "scheduled"] as const;

type ReleaseNamespace = "tasks" | "assignments";

type ReleaseControlProps = {
  namespace: ReleaseNamespace;
  mode: ReleaseMode;
  scheduledReleaseAt: string;
  onModeChange: (next: ReleaseMode) => void;
  onScheduledChange: (next: string) => void;
};

export function ReleaseControl({
  namespace,
  mode,
  scheduledReleaseAt,
  onModeChange,
  onScheduledChange,
}: ReleaseControlProps) {
  const { t } = useTranslation(namespace);

  return (
    <Field>
      <FieldLabel>{t("releaseLabel")}</FieldLabel>
      <FieldDescription>{t("releaseDescription")}</FieldDescription>
      <RadioGroup
        value={mode}
        onValueChange={(value) => {
          if (value === "released" || value === "hidden" || value === "scheduled") {
            onModeChange(value);
          }
        }}
        className="gap-2"
      >
        {RELEASE_MODES.map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5"
          >
            <RadioGroupItem value={value} />
            <span className="text-sm">
              {value === "released"
                ? t("releaseReleased")
                : value === "hidden"
                  ? t("releaseHidden")
                  : t("releaseScheduled")}
            </span>
          </label>
        ))}
      </RadioGroup>
      {mode === "scheduled" ? (
        <Field>
          <FieldLabel htmlFor={`${namespace}-scheduled-release-at`}>
            {t("releaseScheduleAt")}
          </FieldLabel>
          <Input
            id={`${namespace}-scheduled-release-at`}
            type="datetime-local"
            value={scheduledReleaseAt}
            onChange={(event) => onScheduledChange(event.target.value)}
          />
        </Field>
      ) : null}
    </Field>
  );
}

type ReleaseStatusBadgesProps = {
  namespace: ReleaseNamespace;
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
};

export function ReleaseStatusBadges({
  namespace,
  hiddenFromStudents,
  scheduledReleaseAt,
}: ReleaseStatusBadgesProps) {
  const { t } = useTranslation(namespace);

  if (scheduledReleaseAt !== undefined) {
    return (
      <Badge variant="outline" className="w-fit">
        {t("scheduledFor", { date: new Date(scheduledReleaseAt).toLocaleString() })}
      </Badge>
    );
  }
  if (hiddenFromStudents === true) {
    return (
      <Badge variant="outline" className="w-fit">
        {t("hiddenBadge")}
      </Badge>
    );
  }
  return null;
}
