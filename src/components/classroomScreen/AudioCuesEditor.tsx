import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OptionalCollapsible } from "@/components/classroomScreen/OptionalCollapsible";
import {
  AudioCueSelect,
  type AudioFileOption,
  type CueSelectValue,
} from "@/components/classroomScreen/AudioCueSelect";
import {
  audioIdToSelectValue,
  selectValueToAudioId,
} from "@/lib/classroomScreen/audioCueSelectUtils";
import { Button } from "@/components/ui/button";
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
  allowInherit?: boolean;
  onChange: (value: AudioCues) => void;
  onPreview?: (audioId: string) => void;
}

function updateSlot(
  cues: AudioCues,
  key: keyof Pick<
    AudioCues,
    | "segmentStart"
    | "segmentEnd"
    | "sessionComplete"
    | "overtimeStart"
    | "pause"
    | "resume"
    | "skip"
    | "stop"
  >,
  audioId: CueRef | undefined,
  repeat?: string,
): AudioCues {
  const next = { ...cues };
  if (audioId === undefined && repeat === undefined) {
    delete next[key];
    return next;
  }
  next[key] = {
    audioId,
    repeat: repeat !== undefined ? Number(repeat) || 1 : (cues[key]?.repeat ?? 1),
  };
  return next;
}

function SlotRow({
  label,
  slotKey,
  value,
  files,
  allowInherit,
  onChange,
  onPreview,
}: {
  label: string;
  slotKey: keyof Pick<
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
  value: AudioCues;
  files: AudioFileOption[];
  allowInherit: boolean;
  onChange: (value: AudioCues) => void;
  onPreview?: (audioId: string) => void;
}) {
  const { t } = useTranslation("classroomScreen");
  const slot = value[slotKey];
  const selectValue = audioIdToSelectValue(slot?.audioId, allowInherit);

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <AudioCueSelect
        label={label}
        value={selectValue}
        files={files}
        allowInherit={allowInherit}
        onPreview={onPreview}
        inheritLabel={t("audioInheritDefault")}
        noneLabel={t("audioNoneSilent")}
        onChange={(next, audioId) => {
          if (next === "inherit") {
            const updated = { ...value };
            delete updated[slotKey];
            onChange(updated);
            return;
          }
          onChange(updateSlot(value, slotKey, audioId, String(slot?.repeat ?? 1)));
        }}
      />
      {selectValue !== "inherit" && selectValue !== "none" && (
        <div className="grid gap-2">
          <Label>{t("audioRepeatCount")}</Label>
          <NumberInput
            value={slot?.repeat ?? 1}
            onValueChange={(v) =>
              onChange(
                updateSlot(value, slotKey, slot?.audioId ?? (selectValue as CueRef), String(v)),
              )
            }
            min={1}
            step={1}
          />
        </div>
      )}
    </div>
  );
}

type VideoMode = "inherit" | "none" | "set";

function videoModeFromCue(video: VideoCue | undefined, allowInherit: boolean): VideoMode {
  if (!video) return allowInherit ? "inherit" : "none";
  if (video.youtubeId === "none") return "none";
  return "set";
}

function VideoCueRow({
  value,
  allowInherit,
  onChange,
}: {
  value: AudioCues;
  allowInherit: boolean;
  onChange: (value: AudioCues) => void;
}) {
  const { t } = useTranslation("classroomScreen");
  const video = value.video;
  const mode = videoModeFromCue(video, allowInherit);
  const urlInput = video?.youtubeId && video.youtubeId !== "none" ? video.youtubeId : "";

  const parsedId = useMemo(() => {
    if (mode !== "set" || !urlInput.trim()) return null;
    return parseYouTubeId(urlInput);
  }, [mode, urlInput]);

  const updateVideo = (patch: Partial<VideoCue>) => {
    onChange({
      ...value,
      video: { ...video, ...patch },
    });
  };

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-2">
        <Label>{t("videoDuringSegment")}</Label>
        <Select
          value={mode}
          onValueChange={(next) => {
            if (next === "inherit") {
              const updated = { ...value };
              delete updated.video;
              onChange(updated);
              return;
            }
            if (next === "none") {
              onChange({ ...value, video: { youtubeId: "none" } });
              return;
            }
            onChange({
              ...value,
              video: {
                youtubeId: parsedId ?? video?.youtubeId,
                position: video?.position ?? "top",
                size: video?.size ?? "small",
                muted: video?.muted ?? false,
              },
            });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {mode === "inherit"
                ? t("audioInheritDefault")
                : mode === "none"
                  ? t("videoNone")
                  : t("videoSet")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowInherit && <SelectItem value="inherit">{t("audioInheritDefault")}</SelectItem>}
            <SelectItem value="none">{t("videoNone")}</SelectItem>
            <SelectItem value="set">{t("videoSet")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                value={(video?.position as VideoPosition) ?? "top"}
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
                      }[(video?.position as VideoPosition) ?? "top"]
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
                value={(video?.size as VideoSize) ?? "small"}
                onValueChange={(v) => updateVideo({ size: v as VideoSize })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {
                      {
                        small: t("videoSizeSmall"),
                        medium: t("videoSizeMedium"),
                        large: t("videoSizeLarge"),
                      }[(video?.size as VideoSize) ?? "small"]
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
              checked={video?.muted ?? false}
              onCheckedChange={(checked) => updateVideo({ muted: checked })}
            />
          </div>

          {parsedId && (
            <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <iframe
                src={buildEmbedUrl({
                  id: parsedId,
                  muted: video?.muted ?? false,
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
    </div>
  );
}

export function AudioCuesEditor({
  value,
  files,
  allowInherit = false,
  onChange,
  onPreview,
}: AudioCuesEditorProps) {
  const { t } = useTranslation("classroomScreen");
  const countdown = value.countdownTick;
  const interval = value.intervalChime;
  const timeRemaining = value.timeRemaining ?? [];

  const playDuring = value.playDuring;
  const playDuringSelect = audioIdToSelectValue(playDuring?.audioId, allowInherit);
  const countdownSelect = audioIdToSelectValue(countdown?.audioId, allowInherit);
  const intervalSelect = audioIdToSelectValue(interval?.audioId, allowInherit);

  const updateTimeRemaining = (index: number, patch: Partial<(typeof timeRemaining)[number]>) => {
    const next = [...timeRemaining];
    next[index] = { ...next[index]!, ...patch };
    onChange({ ...value, timeRemaining: next });
  };

  return (
    <div className="grid gap-4">
      <OptionalCollapsible title={t("audioTimerEvents")}>
        <SlotRow
          label={t("audioSegmentStart")}
          slotKey="segmentStart"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <div className="grid gap-3 rounded-lg border p-3">
          <AudioCueSelect
            label={t("audioPlayDuring")}
            value={playDuringSelect}
            files={files}
            allowInherit={allowInherit}
            onPreview={onPreview}
            inheritLabel={t("audioInheritDefault")}
            noneLabel={t("audioNoneSilent")}
            onChange={(next, audioId) => {
              if (next === "inherit") {
                const updated = { ...value };
                delete updated.playDuring;
                onChange(updated);
                return;
              }
              onChange({ ...value, playDuring: { audioId } });
            }}
          />
          <p className="text-xs text-muted-foreground">{t("audioPlayDuringHint")}</p>
        </div>
        <VideoCueRow value={value} allowInherit={allowInherit} onChange={onChange} />
        <SlotRow
          label={t("audioSegmentEnd")}
          slotKey="segmentEnd"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <SlotRow
          label={t("audioSessionComplete")}
          slotKey="sessionComplete"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <SlotRow
          label={t("audioOvertimeStart")}
          slotKey="overtimeStart"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
      </OptionalCollapsible>

      <OptionalCollapsible title={t("audioWarningsTicks")}>
        <div className="grid gap-3 rounded-lg border p-3">
          <Label>{t("audioTimeRemainingWarnings")}</Label>
          <p className="text-xs text-muted-foreground">{t("audioTimeRemainingHint")}</p>
          {timeRemaining.map((rule, index) => (
            <div key={index} className="grid gap-2 rounded-md border p-3">
              <AudioCueSelect
                label={t("audioWarningSound", { number: index + 1 })}
                value={audioIdToSelectValue(rule.audioId, false) as CueSelectValue}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = timeRemaining.filter((_, i) => i !== index);
                  onChange({
                    ...value,
                    timeRemaining: next.length > 0 ? next : undefined,
                  });
                }}
              >
                <Trash2 />
                {t("audioRemoveWarning")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                timeRemaining: [...timeRemaining, { secondsRemaining: 60, repeat: 1 }],
              })
            }
          >
            <Plus />
            {t("audioAddWarning")}
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border p-3">
          <AudioCueSelect
            label={t("audioCountdownTick")}
            value={countdownSelect}
            files={files}
            allowInherit={allowInherit}
            onPreview={onPreview}
            inheritLabel={t("audioInheritDefault")}
            noneLabel={t("audioNoneSilent")}
            onChange={(next, audioId) => {
              if (next === "inherit") {
                const updated = { ...value };
                delete updated.countdownTick;
                onChange(updated);
                return;
              }
              onChange({
                ...value,
                countdownTick: {
                  audioId,
                  lastSeconds: countdown?.lastSeconds ?? 10,
                },
              });
            }}
          />
          {countdownSelect !== "inherit" && countdownSelect !== "none" && (
            <div className="grid gap-2">
              <Label>{t("audioLastSeconds")}</Label>
              <NumberInput
                value={countdown?.lastSeconds ?? 10}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    countdownTick: {
                      audioId: countdown?.audioId ?? selectValueToAudioId(countdownSelect),
                      lastSeconds: v,
                    },
                  })
                }
                min={1}
                step={1}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border p-3">
          <AudioCueSelect
            label={t("audioIntervalChime")}
            value={intervalSelect}
            files={files}
            allowInherit={allowInherit}
            onPreview={onPreview}
            inheritLabel={t("audioInheritDefault")}
            noneLabel={t("audioNoneSilent")}
            onChange={(next, audioId) => {
              if (next === "inherit") {
                const updated = { ...value };
                delete updated.intervalChime;
                onChange(updated);
                return;
              }
              onChange({
                ...value,
                intervalChime: {
                  audioId,
                  everyMinutes: interval?.everyMinutes ?? 5,
                },
              });
            }}
          />
          {intervalSelect !== "inherit" && intervalSelect !== "none" && (
            <div className="grid gap-2">
              <Label>{t("audioEveryMinutes")}</Label>
              <NumberInput
                value={interval?.everyMinutes ?? 5}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    intervalChime: {
                      audioId: interval?.audioId ?? selectValueToAudioId(intervalSelect),
                      everyMinutes: v,
                    },
                  })
                }
                min={1}
                step={1}
              />
            </div>
          )}
        </div>
      </OptionalCollapsible>

      <OptionalCollapsible title={t("audioTransportControls")}>
        <SlotRow
          label={t("audioPause")}
          slotKey="pause"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <SlotRow
          label={t("audioResume")}
          slotKey="resume"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <SlotRow
          label={t("audioSkip")}
          slotKey="skip"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
        <SlotRow
          label={t("audioStop")}
          slotKey="stop"
          value={value}
          files={files}
          allowInherit={allowInherit}
          onChange={onChange}
          onPreview={onPreview}
        />
      </OptionalCollapsible>
    </div>
  );
}
