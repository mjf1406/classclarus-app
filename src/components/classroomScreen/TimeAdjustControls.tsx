import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TIME_ADJUSTMENTS = [
  { unit: "seconds" as const, count: 1, seconds: 1 },
  { unit: "seconds" as const, count: 5, seconds: 5 },
  { unit: "seconds" as const, count: 10, seconds: 10 },
  { unit: "minutes" as const, count: 1, seconds: 60 },
  { unit: "minutes" as const, count: 5, seconds: 300 },
  { unit: "minutes" as const, count: 10, seconds: 600 },
] as const;

const PROMINENT_ADJUST_SECONDS = 30;

function TimeAdjustButton({
  buttonKey,
  deltaSeconds,
  remaining,
  errorKey,
  onError,
  onAdjust,
  children,
  size = "sm" as "sm" | "lg",
}: {
  buttonKey: string;
  deltaSeconds: number;
  remaining: number;
  errorKey: string | null;
  onError: (key: string | null) => void;
  onAdjust: (deltaSeconds: number) => void;
  children: React.ReactNode;
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation("classroomScreen");
  const open = errorKey === buttonKey;

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => onError(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [open, onError]);

  const handleClick = () => {
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
        render={<Button type="button" variant="secondary" size={size} onClick={handleClick} />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" className="text-destructive">
        {t("adjustBelowZero")}
      </PopoverContent>
    </Popover>
  );
}

export function PlusMinusThirtyButtons({
  remaining,
  onAdjust,
  size = "lg",
}: {
  remaining: number;
  onAdjust: (deltaSeconds: number) => void;
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation("classroomScreen");
  const [adjustErrorKey, setAdjustErrorKey] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <TimeAdjustButton
        buttonKey="minus-30s"
        deltaSeconds={-PROMINENT_ADJUST_SECONDS}
        remaining={remaining}
        errorKey={adjustErrorKey}
        onError={setAdjustErrorKey}
        onAdjust={onAdjust}
        size={size}
      >
        <Minus />
        {t("adjust30s")}
      </TimeAdjustButton>
      <TimeAdjustButton
        buttonKey="plus-30s"
        deltaSeconds={PROMINENT_ADJUST_SECONDS}
        remaining={remaining}
        errorKey={adjustErrorKey}
        onError={setAdjustErrorKey}
        onAdjust={onAdjust}
        size={size}
      >
        <Plus />
        {t("adjust30s")}
      </TimeAdjustButton>
    </div>
  );
}

export function TimeAdjustControls({
  remaining,
  onAdjust,
  showProminentThirty = true,
}: {
  remaining: number;
  onAdjust: (deltaSeconds: number) => void;
  showProminentThirty?: boolean;
}) {
  const { t } = useTranslation("classroomScreen");
  const [adjustErrorKey, setAdjustErrorKey] = useState<string | null>(null);

  const presetLabel = (preset: (typeof TIME_ADJUSTMENTS)[number]) =>
    t(preset.unit === "seconds" ? "presetSeconds" : "presetMinutes", { count: preset.count });

  return (
    <>
      {showProminentThirty ? (
        <PlusMinusThirtyButtons remaining={remaining} onAdjust={onAdjust} />
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[...TIME_ADJUSTMENTS].reverse().map((preset) => (
          <TimeAdjustButton
            key={`minus-${preset.unit}-${preset.count}`}
            buttonKey={`minus-${preset.unit}-${preset.count}`}
            deltaSeconds={-preset.seconds}
            remaining={remaining}
            errorKey={adjustErrorKey}
            onError={setAdjustErrorKey}
            onAdjust={onAdjust}
          >
            <Minus />
            {presetLabel(preset)}
          </TimeAdjustButton>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TIME_ADJUSTMENTS.map((preset) => (
          <TimeAdjustButton
            key={`plus-${preset.unit}-${preset.count}`}
            buttonKey={`plus-${preset.unit}-${preset.count}`}
            deltaSeconds={preset.seconds}
            remaining={remaining}
            errorKey={adjustErrorKey}
            onError={setAdjustErrorKey}
            onAdjust={onAdjust}
          >
            <Plus />
            {presetLabel(preset)}
          </TimeAdjustButton>
        ))}
      </div>
    </>
  );
}
