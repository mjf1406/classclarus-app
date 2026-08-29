import { useTranslation } from "react-i18next";

import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertDurationUnit, type DurationUnit } from "@/lib/classroomScreen/durationInputUtils";
import { cn } from "@/lib/utils";

export type { DurationUnit };

interface DurationInputProps {
  value: string;
  unit: DurationUnit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: DurationUnit) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  secondsLabel?: string;
  minutesLabel?: string;
}

export function DurationInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  min = 0,
  step,
  disabled,
  className,
  secondsLabel,
  minutesLabel,
}: DurationInputProps) {
  const { t } = useTranslation("classroomScreen");
  const resolvedSecondsLabel = secondsLabel ?? t("durationSeconds");
  const resolvedMinutesLabel = minutesLabel ?? t("durationMinutes");
  const numericValue = Number(value);
  const displayStep = step ?? (unit === "minutes" ? 0.1 : 30);
  const displayMin = unit === "minutes" && min > 0 ? min / 60 : min;

  const handleUnitChange = (newUnit: DurationUnit) => {
    onValueChange(convertDurationUnit(value, unit, newUnit));
    onUnitChange(newUnit);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <NumberInput
        value={Number.isFinite(numericValue) ? numericValue : 0}
        onValueChange={(next) => onValueChange(String(next))}
        min={displayMin}
        step={displayStep}
        disabled={disabled}
        inputClassName="w-24 min-w-[96px]"
        className="flex-1"
      />
      <Select
        value={unit}
        onValueChange={(v) => {
          if (v) handleUnitChange(v as DurationUnit);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[7.5rem] shrink-0">
          <SelectValue>
            {unit === "minutes" ? resolvedMinutesLabel : resolvedSecondsLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="seconds">{resolvedSecondsLabel}</SelectItem>
          <SelectItem value="minutes">{resolvedMinutesLabel}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
