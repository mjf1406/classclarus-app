import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BG_TRANSITION_GLOBAL_VALUE,
  BG_TRANSITION_LABEL_KEYS,
  BG_TRANSITION_OPTIONS,
} from "@/lib/classroomScreen/bgTransitions";

interface BgTransitionSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  showGlobalOption?: boolean;
  id?: string;
  globalOptionLabel?: string;
}

export function BgTransitionSelect({
  value,
  onValueChange,
  label,
  showGlobalOption = false,
  id,
  globalOptionLabel,
}: BgTransitionSelectProps) {
  const { t } = useTranslation("classroomScreen");
  const resolvedLabel = label ?? t("timerBgTransition");
  const resolvedGlobalLabel = globalOptionLabel ?? t("bgTransitionGlobal");

  const selectedLabel =
    value === BG_TRANSITION_GLOBAL_VALUE
      ? resolvedGlobalLabel
      : value in BG_TRANSITION_LABEL_KEYS
        ? t(BG_TRANSITION_LABEL_KEYS[value as keyof typeof BG_TRANSITION_LABEL_KEYS])
        : value;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{resolvedLabel}</Label>
      <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {showGlobalOption && (
            <SelectItem value={BG_TRANSITION_GLOBAL_VALUE}>{resolvedGlobalLabel}</SelectItem>
          )}
          {BG_TRANSITION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(BG_TRANSITION_LABEL_KEYS[option.value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
