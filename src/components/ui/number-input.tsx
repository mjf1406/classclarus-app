import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "prefix"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decorative text shown inside the field before the value (e.g. "×"). */
  prefix?: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NumberInput({
  value,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled,
  className,
  id,
  prefix,
  onBlur,
  ...props
}: NumberInputProps) {
  const { t } = useTranslation("common");
  /** `null` = show committed `value`; otherwise the in-progress input text (may be empty). */
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  const setClamped = (next: number) => {
    if (!Number.isFinite(next)) return;
    const normalized = Number.isInteger(step) ? Math.trunc(next) : next;
    onValueChange(clamp(normalized, min, max));
  };

  const commitDraftOrRevert = () => {
    if (draft === null) return;
    if (draft === "" || draft === "-") {
      setDraft(null);
      return;
    }
    const next = Number(draft);
    if (Number.isFinite(next)) setClamped(next);
    setDraft(null);
  };

  return (
    <div data-slot="number-input" className={cn("flex w-fit items-stretch", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value <= min}
        aria-label={t("decreaseValue")}
        aria-controls={id}
        className="shrink-0 rounded-r-none focus-visible:z-10"
        onClick={() => {
          setDraft(null);
          setClamped(value - step);
        }}
      >
        <MinusIcon />
      </Button>
      <div className="relative -ml-px">
        {prefix != null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 z-10 -translate-y-1/2 text-sm text-muted-foreground select-none"
          >
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          disabled={disabled}
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          value={draft ?? value}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              setDraft("");
              return;
            }
            // Allow typing a leading minus when negatives are in range.
            if (raw === "-" && min < 0) {
              setDraft("-");
              return;
            }
            const next = event.target.valueAsNumber;
            if (!Number.isFinite(next)) {
              setDraft(raw);
              return;
            }
            setDraft(null);
            setClamped(next);
          }}
          onBlur={(event) => {
            commitDraftOrRevert();
            onBlur?.(event);
          }}
          className={cn(
            "w-16 rounded-none tabular-nums focus-visible:z-10",
            prefix != null ? "pr-2 pl-5 text-left" : "text-center",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
          {...props}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value >= max}
        aria-label={t("increaseValue")}
        aria-controls={id}
        className="-ml-px shrink-0 rounded-l-none focus-visible:z-10"
        onClick={() => {
          setDraft(null);
          setClamped(value + step);
        }}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export { NumberInput };
