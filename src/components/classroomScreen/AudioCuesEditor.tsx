import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AudioCueSelect, type AudioFileOption } from "@/components/classroomScreen/AudioCueSelect";
import { audioIdToSelectValue } from "@/lib/classroomScreen/audioCueSelectUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AudioCues, CueRef, VideoCue } from "@/lib/classroomScreen/audioCues";
import {
  buildEmbedUrl,
  parseYouTubeId,
  VIDEO_SIZE_WIDTH,
  type VideoPosition,
  type VideoSize,
} from "@/lib/classroomScreen/audioCues";

interface AudioCuesEditorProps {
  value: AudioCues;
  files: AudioFileOption[];
  /** Kept for API compatibility: absence of a cue means "inherit" when true, "silent" when false. */
  allowInherit?: boolean;
  onChange: (value: AudioCues) => void;
  onPreview?: (audioId: string) => void;
}

type SlotKey = keyof Pick<
  AudioCues,
  | "segmentStart"
  | "segmentEnd"
  | "sessionComplete"
  | "overtimeStart"
  | "pause"
  | "resume"
  | "skip"
  | "stop"
>;

type CueKey = SlotKey | "playDuring" | "video" | "countdownTick" | "intervalChime";

type CueGroup = "events" | "warnings" | "transport";

type CueEntry = {
  key: CueKey | "timeRemaining";
  group: CueGroup;
  labelKey: string;
};

/** Menu + render order. `timeRemaining` is repeatable; everything else is a single row. */
const CUE_ENTRIES: CueEntry[] = [
  { key: "segmentStart", group: "events", labelKey: "audioSegmentStart" },
  { key: "playDuring", group: "events", labelKey: "audioPlayDuring" },
  { key: "video", group: "events", labelKey: "videoDuringSegment" },
  { key: "segmentEnd", group: "events", labelKey: "audioSegmentEnd" },
  { key: "sessionComplete", group: "events", labelKey: "audioSessionComplete" },
  { key: "overtimeStart", group: "events", labelKey: "audioOvertimeStart" },
  { key: "timeRemaining", group: "warnings", labelKey: "audioTimeRemainingWarning" },
  { key: "countdownTick", group: "warnings", labelKey: "audioCountdownTick" },
  { key: "intervalChime", group: "warnings", labelKey: "audioIntervalChime" },
  { key: "pause", group: "transport", labelKey: "audioPause" },
  { key: "resume", group: "transport", labelKey: "audioResume" },
  { key: "skip", group: "transport", labelKey: "audioSkip" },
  { key: "stop", group: "transport", labelKey: "audioStop" },
];

const GROUP_LABEL_KEYS: Record<CueGroup, string> = {
  events: "audioTimerEvents",
  warnings: "audioWarningsTicks",
  transport: "audioTransportControls",
};

function CueRow({
  title,
  removeLabel,
  onRemove,
  children,
}: {
  title: string;
  removeLabel: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{title}</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      {children}
    </div>
  );
}

function VideoCueFields({
  video,
  onChange,
}: {
  video: VideoCue;
  onChange: (video: VideoCue) => void;
}) {
  const { t } = useTranslation("classroomScreen");
  const mode: "none" | "set" = video.youtubeId === "none" ? "none" : "set";
  const urlInput = video.youtubeId && video.youtubeId !== "none" ? video.youtubeId : "";

  const parsedId = useMemo(() => {
    if (mode !== "set" || !urlInput.trim()) return null;
    return parseYouTubeId(urlInput);
  }, [mode, urlInput]);

  const updateVideo = (patch: Partial<VideoCue>) => {
    onChange({ ...video, ...patch });
  };

  return (
    <>
      <Select
        value={mode}
        onValueChange={(next) => {
          if (next === "none") {
            onChange({ youtubeId: "none" });
            return;
          }
          onChange({
            youtubeId: parsedId ?? "",
            position: video.position ?? "top",
            size: video.size ?? "small",
            muted: video.muted ?? false,
          });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>{mode === "none" ? t("videoNone") : t("videoSet")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("videoNone")}</SelectItem>
          <SelectItem value="set">{t("videoSet")}</SelectItem>
        </SelectContent>
      </Select>

      {mode === "set" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="video-url">{t("videoUrlLabel")}</Label>
            <Input
              id="video-url"
              value={urlInput}
              onChange={(e) => updateVideo({ youtubeId: e.target.value.trim() })}
              placeholder={t("videoUrlPlaceholder")}
            />
            {urlInput.trim() && !parsedId && (
              <p className="text-xs text-destructive">{t("videoUrlInvalid")}</p>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("videoPosition")}</Label>
              <Select
                value={(video.position as VideoPosition) ?? "top"}
                onValueChange={(v) => updateVideo({ position: v as VideoPosition })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {
                      {
                        top: t("videoPositionTop"),
                        bottom: t("videoPositionBottom"),
                        left: t("videoPositionLeft"),
                        right: t("videoPositionRight"),
                      }[(video.position as VideoPosition) ?? "top"]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">{t("videoPositionTop")}</SelectItem>
                  <SelectItem value="bottom">{t("videoPositionBottom")}</SelectItem>
                  <SelectItem value="left">{t("videoPositionLeft")}</SelectItem>
                  <SelectItem value="right">{t("videoPositionRight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("videoSize")}</Label>
              <Select
                value={(video.size as VideoSize) ?? "small"}
                onValueChange={(v) => updateVideo({ size: v as VideoSize })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {
                      {
                        small: t("videoSizeSmall"),
                        medium: t("videoSizeMedium"),
                        large: t("videoSizeLarge"),
                      }[(video.size as VideoSize) ?? "small"]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">{t("videoSizeSmall")}</SelectItem>
                  <SelectItem value="medium">{t("videoSizeMedium")}</SelectItem>
                  <SelectItem value="large">{t("videoSizeLarge")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="video-muted">{t("videoMuted")}</Label>
              <p className="text-xs text-muted-foreground">{t("videoMutedHint")}</p>
            </div>
            <Switch
              id="video-muted"
              checked={video.muted ?? false}
              onCheckedChange={(checked) => updateVideo({ muted: checked })}
            />
          </div>

          {parsedId && (
            <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <iframe
                src={buildEmbedUrl({
                  id: parsedId,
                  muted: video.muted ?? false,
                  loop: true,
                })}
                title={t("videoPreviewTitle")}
                className="aspect-video w-full border-0"
                style={{ maxWidth: VIDEO_SIZE_WIDTH.small }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">{t("videoHint")}</p>
    </>
  );
}

export function AudioCuesEditor({ value, files, onChange, onPreview }: AudioCuesEditorProps) {
  const { t } = useTranslation("classroomScreen");
  const timeRemaining = value.timeRemaining ?? [];
  const defaultSound: CueRef = files[0]?.id ?? "none";

  const isConfigured = (key: CueKey | "timeRemaining") =>
    key === "timeRemaining" ? timeRemaining.length > 0 : value[key] !== undefined;

  const addCue = (key: CueKey | "timeRemaining") => {
    switch (key) {
      case "playDuring":
        onChange({ ...value, playDuring: { audioId: defaultSound } });
        break;
      case "video":
        onChange({
          ...value,
          video: { youtubeId: "", position: "top", size: "small", muted: false },
        });
        break;
      case "countdownTick":
        onChange({ ...value, countdownTick: { audioId: defaultSound, lastSeconds: 10 } });
        break;
      case "intervalChime":
        onChange({ ...value, intervalChime: { audioId: defaultSound, everyMinutes: 5 } });
        break;
      case "timeRemaining":
        onChange({
          ...value,
          timeRemaining: [
            ...timeRemaining,
            { audioId: defaultSound, secondsRemaining: 60, repeat: 1 },
          ],
        });
        break;
      default:
        onChange({ ...value, [key]: { audioId: defaultSound, repeat: 1 } });
    }
  };

  const removeCue = (key: CueKey) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const updateTimeRemaining = (index: number, patch: Partial<(typeof timeRemaining)[number]>) => {
    const next = [...timeRemaining];
    next[index] = { ...next[index]!, ...patch };
    onChange({ ...value, timeRemaining: next });
  };

  const removeTimeRemaining = (index: number) => {
    const next = timeRemaining.filter((_, i) => i !== index);
    onChange({ ...value, timeRemaining: next.length > 0 ? next : undefined });
  };

  const renderRow = (entry: CueEntry) => {
    const title = t(entry.labelKey);
    const removeLabel = t("audioRemoveCue", { label: title });

    if (entry.key === "timeRemaining") {
      return timeRemaining.map((rule, index) => {
        const rowTitle = timeRemaining.length > 1 ? `${title} ${String(index + 1)}` : title;
        return (
          <CueRow
            key={`timeRemaining-${String(index)}`}
            title={rowTitle}
            removeLabel={t("audioRemoveCue", { label: rowTitle })}
            onRemove={() => removeTimeRemaining(index)}
          >
            <AudioCueSelect
              hideLabel
              label={rowTitle}
              value={audioIdToSelectValue(rule.audioId, false)}
              files={files}
              onPreview={onPreview}
              noneLabel={t("audioNoneSilent")}
              onChange={(_, audioId) => updateTimeRemaining(index, { audioId })}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>{t("audioSecondsRemaining")}</Label>
                <NumberInput
                  value={rule.secondsRemaining}
                  onValueChange={(v) => updateTimeRemaining(index, { secondsRemaining: v })}
                  min={1}
                  step={1}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("audioRepeatCount")}</Label>
                <NumberInput
                  value={rule.repeat ?? 1}
                  onValueChange={(v) => updateTimeRemaining(index, { repeat: v })}
                  min={1}
                  step={1}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("audioTimeRemainingHint")}</p>
          </CueRow>
        );
      });
    }

    if (!isConfigured(entry.key)) return null;

    if (entry.key === "video") {
      const video = value.video ?? {};
      return (
        <CueRow
          key={entry.key}
          title={title}
          removeLabel={removeLabel}
          onRemove={() => removeCue("video")}
        >
          <VideoCueFields video={video} onChange={(next) => onChange({ ...value, video: next })} />
        </CueRow>
      );
    }

    if (entry.key === "playDuring") {
      const cue = value.playDuring;
      return (
        <CueRow
          key={entry.key}
          title={title}
          removeLabel={removeLabel}
          onRemove={() => removeCue("playDuring")}
        >
          <AudioCueSelect
            hideLabel
            label={title}
            value={audioIdToSelectValue(cue?.audioId, false)}
            files={files}
            onPreview={onPreview}
            noneLabel={t("audioNoneSilent")}
            onChange={(_, audioId) => onChange({ ...value, playDuring: { audioId } })}
          />
          <p className="text-xs text-muted-foreground">{t("audioPlayDuringHint")}</p>
        </CueRow>
      );
    }

    if (entry.key === "countdownTick") {
      const cue = value.countdownTick;
      const selectValue = audioIdToSelectValue(cue?.audioId, false);
      return (
        <CueRow
          key={entry.key}
          title={title}
          removeLabel={removeLabel}
          onRemove={() => removeCue("countdownTick")}
        >
          <AudioCueSelect
            hideLabel
            label={title}
            value={selectValue}
            files={files}
            onPreview={onPreview}
            noneLabel={t("audioNoneSilent")}
            onChange={(_, audioId) =>
              onChange({
                ...value,
                countdownTick: { audioId, lastSeconds: cue?.lastSeconds ?? 10 },
              })
            }
          />
          {selectValue !== "none" && (
            <div className="grid gap-2">
              <Label>{t("audioLastSeconds")}</Label>
              <NumberInput
                value={cue?.lastSeconds ?? 10}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    countdownTick: { audioId: cue?.audioId, lastSeconds: v },
                  })
                }
                min={1}
                step={1}
              />
            </div>
          )}
        </CueRow>
      );
    }

    if (entry.key === "intervalChime") {
      const cue = value.intervalChime;
      const selectValue = audioIdToSelectValue(cue?.audioId, false);
      return (
        <CueRow
          key={entry.key}
          title={title}
          removeLabel={removeLabel}
          onRemove={() => removeCue("intervalChime")}
        >
          <AudioCueSelect
            hideLabel
            label={title}
            value={selectValue}
            files={files}
            onPreview={onPreview}
            noneLabel={t("audioNoneSilent")}
            onChange={(_, audioId) =>
              onChange({
                ...value,
                intervalChime: { audioId, everyMinutes: cue?.everyMinutes ?? 5 },
              })
            }
          />
          {selectValue !== "none" && (
            <div className="grid gap-2">
              <Label>{t("audioEveryMinutes")}</Label>
              <NumberInput
                value={cue?.everyMinutes ?? 5}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    intervalChime: { audioId: cue?.audioId, everyMinutes: v },
                  })
                }
                min={1}
                step={1}
              />
            </div>
          )}
        </CueRow>
      );
    }

    const slotKey = entry.key;
    const slot = value[slotKey];
    const selectValue = audioIdToSelectValue(slot?.audioId, false);
    return (
      <CueRow
        key={slotKey}
        title={title}
        removeLabel={removeLabel}
        onRemove={() => removeCue(slotKey)}
      >
        <AudioCueSelect
          hideLabel
          label={title}
          value={selectValue}
          files={files}
          onPreview={onPreview}
          noneLabel={t("audioNoneSilent")}
          onChange={(_, audioId) =>
            onChange({ ...value, [slotKey]: { audioId, repeat: slot?.repeat ?? 1 } })
          }
        />
        {selectValue !== "none" && (
          <div className="grid gap-2">
            <Label>{t("audioRepeatCount")}</Label>
            <NumberInput
              value={slot?.repeat ?? 1}
              onValueChange={(v) =>
                onChange({ ...value, [slotKey]: { audioId: slot?.audioId, repeat: v } })
              }
              min={1}
              step={1}
            />
          </div>
        )}
        {slotKey === "segmentEnd" ? (
          <p className="text-xs text-muted-foreground">{t("audioSegmentEndHint")}</p>
        ) : null}
        {slotKey === "sessionComplete" ? (
          <p className="text-xs text-muted-foreground">{t("audioSessionCompleteHint")}</p>
        ) : null}
      </CueRow>
    );
  };

  const hasRows = CUE_ENTRIES.some((entry) => isConfigured(entry.key));

  const menuGroups = (["events", "warnings", "transport"] as const)
    .map((group) => ({
      group,
      entries: CUE_ENTRIES.filter(
        (entry) =>
          entry.group === group && (entry.key === "timeRemaining" || !isConfigured(entry.key)),
      ),
    }))
    .filter(({ entries }) => entries.length > 0);

  return (
    <div className="grid gap-3">
      {CUE_ENTRIES.map((entry) => renderRow(entry))}

      {!hasRows && <p className="text-sm text-muted-foreground">{t("audioNoCues")}</p>}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" className="justify-self-start" />
          }
        >
          <Plus />
          {t("audioAddCue")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {menuGroups.map(({ group, entries }, groupIndex) => (
            <DropdownMenuGroup key={group}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{t(GROUP_LABEL_KEYS[group])}</DropdownMenuLabel>
              {entries.map((entry) => (
                <DropdownMenuItem key={entry.key} onClick={() => addCue(entry.key)}>
                  {t(entry.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
