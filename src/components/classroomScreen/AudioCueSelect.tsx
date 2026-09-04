import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CueRef } from "@/lib/classroomScreen/audioCues";
import {
  selectValueToAudioId,
  type AudioFileOption,
  type CueSelectValue,
} from "@/lib/classroomScreen/audioCueSelectUtils";

export type { AudioFileOption, CueSelectValue };

interface AudioCueSelectProps {
  label: string;
  /** Render the label only for screen readers (when the surrounding row already shows a title). */
  hideLabel?: boolean;
  value: CueSelectValue;
  files: AudioFileOption[];
  allowInherit?: boolean;
  onChange: (value: CueSelectValue, audioId?: CueRef) => void;
  onPreview?: (audioId: string) => void;
  inheritLabel?: string;
  noneLabel?: string;
  previewLabel?: string;
}

function cueSelectDisplayLabel(
  value: CueSelectValue,
  files: AudioFileOption[],
  inheritLabel: string,
  noneLabel: string,
) {
  if (value === "inherit") return inheritLabel;
  if (value === "none") return noneLabel;
  return files.find((file) => file.id === value)?.name ?? value;
}

export function AudioCueSelect({
  label,
  hideLabel = false,
  value,
  files,
  allowInherit = false,
  onChange,
  onPreview,
  inheritLabel,
  noneLabel,
  previewLabel,
}: AudioCueSelectProps) {
  const { t } = useTranslation("classroomScreen");
  const resolvedInheritLabel = inheritLabel ?? t("audioInheritDefault");
  const resolvedNoneLabel = noneLabel ?? t("audioNoneSilent");
  const previewId = value !== "inherit" && value !== "none" ? value : null;
  const displayLabel = cueSelectDisplayLabel(value, files, resolvedInheritLabel, resolvedNoneLabel);

  return (
    <div className="grid gap-2">
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          onValueChange={(next) => {
            onChange(next as CueSelectValue, selectValueToAudioId(next as CueSelectValue));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{displayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowInherit && <SelectItem value="inherit">{resolvedInheritLabel}</SelectItem>}
            <SelectItem value="none">{resolvedNoneLabel}</SelectItem>
            {files.map((file) => (
              <SelectItem key={file.id} value={file.id}>
                {file.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {previewId && onPreview && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPreview(previewId)}
            aria-label={previewLabel ?? t("audioPreview", { label })}
          >
            <Play />
          </Button>
        )}
      </div>
    </div>
  );
}
