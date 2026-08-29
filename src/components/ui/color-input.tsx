import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Input } from "./input";

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  pickColorLabel?: string;
}

function normalizeHex(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
  return "#000000";
}

export function ColorInput({
  value,
  onChange,
  disabled,
  className,
  pickColorLabel,
}: ColorInputProps) {
  const { t } = useTranslation("classroomScreen");
  const resolvedPickColorLabel = pickColorLabel ?? t("pickColor");
  const colorValue = normalizeHex(value);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="color"
        value={colorValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={resolvedPickColorLabel}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="#000000"
        className="font-mono"
      />
    </div>
  );
}
