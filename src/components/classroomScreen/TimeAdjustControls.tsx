import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TIME_ADJUST_PRESETS, type TimeAdjustPreset } from "@/lib/classroomScreen/durationPresets";

type AdjustButtonSize = "xs" | "sm" | "lg";

function TimeAdjustButton({
  buttonKey,
  deltaSeconds,
  remaining,
  errorKey,
  onError,
  onAdjust,
  children,
  size = "sm",
  disabled = false,
}: {
  buttonKey: string;
  deltaSeconds: number;
  remaining: number;
  errorKey: string | null;
  onError: (key: string | null) => void;
  onAdjust: (deltaSeconds: number) => void;
  children: React.ReactNode;
  size?: AdjustButtonSize;
  disabled?: boolean;
}) {
  const { t } = useTranslation("classroomScreen");
  const open = errorKey === buttonKey;

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => onError(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [open, onError]);

  const handleClick = () => {
    if (disabled) return;
    if (remaining + deltaSeconds < 0) {
      onError(buttonKey);
      return;
    }
    onError(null);
    onAdjust(deltaSeconds);
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => !nextOpen && onError(null)}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size={size}
            className="w-full"
            disabled={disabled}
            onClick={handleClick}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" className="text-destructive">
        {t("adjustBelowZero")}
      </PopoverContent>
    </Popover>
  );
}

export function TimeAdjustControls({
  remaining,
  onAdjust,
  size = "sm",
  disabled = false,
}: {
  remaining: number;
  onAdjust: (deltaSeconds: number) => void;
  size?: AdjustButtonSize;
  disabled?: boolean;
}) {
  const { t } = useTranslation("classroomScreen");
  const [adjustErrorKey, setAdjustErrorKey] = useState<string | null>(null);

  const presetLabel = (preset: TimeAdjustPreset) =>
    t(preset.unit === "seconds" ? "presetSeconds" : "presetMinutes", { count: preset.count });

  return (
    <div className="flex flex-wrap items-start justify-center gap-2">
      {TIME_ADJUST_PRESETS.map((preset) => (
        <div key={`${preset.unit}-${preset.count}`} className="flex min-w-16 flex-col gap-2">
          <TimeAdjustButton
            buttonKey={`minus-${preset.unit}-${preset.count}`}
            deltaSeconds={-preset.seconds}
            remaining={remaining}
            errorKey={adjustErrorKey}
            onError={setAdjustErrorKey}
            onAdjust={onAdjust}
            size={size}
            disabled={disabled}
          >
            <Minus />
            {presetLabel(preset)}
          </TimeAdjustButton>
          <TimeAdjustButton
            buttonKey={`plus-${preset.unit}-${preset.count}`}
            deltaSeconds={preset.seconds}
            remaining={remaining}
            errorKey={adjustErrorKey}
            onError={setAdjustErrorKey}
            onAdjust={onAdjust}
            size={size}
            disabled={disabled}
          >
            <Plus />
            {presetLabel(preset)}
          </TimeAdjustButton>
        </div>
      ))}
    </div>
  );
}
