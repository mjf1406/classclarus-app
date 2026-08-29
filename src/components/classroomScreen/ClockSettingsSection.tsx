import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AudioCuesEditor } from "@/components/classroomScreen/AudioCuesEditor";
import { BgTransitionSelect } from "@/components/classroomScreen/BgTransitionSelect";
import { ColorInput } from "@/components/ui/color-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpsertClassroomSettings } from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  useClassroomAudioFiles,
  useClassroomSettings,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { getAllAudioOptions, toAudioUrlList } from "@/lib/classroomScreen/audioOptions";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import { stripUndefinedAudioCues } from "@/lib/classroomScreen/audioCues";
import { createAudioUrlMap, useAudioPlayer } from "@/lib/classroomScreen/audio-engine";
import {
  CLOCK_SIZE_OPTIONS,
  DATE_SIZE_OPTIONS,
  DEFAULT_CLOCK_SETTINGS,
  DISPLAY_FONT_SIZE_OPTIONS,
  snapToSizeOption,
  type SizeLabelKey,
} from "@/lib/classroomScreen/clockSettings";
import type { Id } from "../../../convex/_generated/dataModel";

type ClockSettingsForm = {
  clockSize: string;
  dateSize: string;
  currentTimeSize: string;
  endTimeSize: string;
  timerTitleSize: string;
  clockBgColor: string;
  timerBgColor: string;
  dateLocation: "above" | "below";
  timeFormat: "12h" | "24h";
  timerEndBehavior: "countUp" | "hold" | "return";
  overtimeAutoDismissSeconds: string;
  bgTransition: string;
  audioCues: AudioCues;
  displayContentFontSize: string;
  displayHeadingFontSize: string;
};

type ClockSettingsSectionProps = {
  classId: Id<"classes">;
};

function namedSizeLabel(
  t: (key: SizeLabelKey | "fontSizePx", options?: { size: number }) => string,
  options: readonly { value: number; labelKey: SizeLabelKey }[],
  value: string,
) {
  const option = options.find((item) => String(item.value) === value);
  return option ? `${t(option.labelKey)} (${t("fontSizePx", { size: option.value })})` : value;
}

function formFromSettings(settings: {
  clockSize?: number;
  dateSize?: number;
  currentTimeSize?: number;
  endTimeSize?: number;
  timerTitleSize?: number;
  clockBgColor?: string;
  timerBgColor?: string;
  dateLocation?: "above" | "below";
  timeFormat?: "12h" | "24h";
  timerEndBehavior?: "countUp" | "hold" | "return";
  overtimeAutoDismissSeconds?: number;
  bgTransition?: string;
  audioCues?: AudioCues;
  displayContentFontSize?: number;
  displayHeadingFontSize?: number;
}): ClockSettingsForm {
  return {
    clockSize: String(
      snapToSizeOption(settings.clockSize ?? DEFAULT_CLOCK_SETTINGS.clockSize, CLOCK_SIZE_OPTIONS),
    ),
    dateSize: String(
      snapToSizeOption(settings.dateSize ?? DEFAULT_CLOCK_SETTINGS.dateSize, DATE_SIZE_OPTIONS),
    ),
    currentTimeSize: String(
      snapToSizeOption(
        settings.currentTimeSize ?? DEFAULT_CLOCK_SETTINGS.currentTimeSize,
        DATE_SIZE_OPTIONS,
      ),
    ),
    endTimeSize: String(
      snapToSizeOption(
        settings.endTimeSize ?? DEFAULT_CLOCK_SETTINGS.endTimeSize,
        DATE_SIZE_OPTIONS,
      ),
    ),
    timerTitleSize: String(
      snapToSizeOption(
        settings.timerTitleSize ?? DEFAULT_CLOCK_SETTINGS.timerTitleSize,
        DATE_SIZE_OPTIONS,
      ),
    ),
    clockBgColor: settings.clockBgColor ?? DEFAULT_CLOCK_SETTINGS.clockBgColor,
    timerBgColor: settings.timerBgColor ?? DEFAULT_CLOCK_SETTINGS.timerBgColor,
    dateLocation: settings.dateLocation ?? DEFAULT_CLOCK_SETTINGS.dateLocation,
    timeFormat: settings.timeFormat ?? DEFAULT_CLOCK_SETTINGS.timeFormat,
    timerEndBehavior: settings.timerEndBehavior ?? DEFAULT_CLOCK_SETTINGS.timerEndBehavior,
    overtimeAutoDismissSeconds: String(settings.overtimeAutoDismissSeconds ?? 0),
    bgTransition: settings.bgTransition ?? DEFAULT_CLOCK_SETTINGS.bgTransition,
    audioCues: settings.audioCues ?? {},
    displayContentFontSize: String(
      snapToSizeOption(
        settings.displayContentFontSize ?? DEFAULT_CLOCK_SETTINGS.displayContentFontSize,
        DISPLAY_FONT_SIZE_OPTIONS,
      ),
    ),
    displayHeadingFontSize: String(
      snapToSizeOption(
        settings.displayHeadingFontSize ?? DEFAULT_CLOCK_SETTINGS.displayHeadingFontSize,
        DISPLAY_FONT_SIZE_OPTIONS,
      ),
    ),
  };
}

function payloadFromForm(classId: Id<"classes">, form: ClockSettingsForm) {
  return {
    classId,
    clockSize: Number(form.clockSize),
    dateSize: Number(form.dateSize),
    currentTimeSize: Number(form.currentTimeSize),
    endTimeSize: Number(form.endTimeSize),
    timerTitleSize: Number(form.timerTitleSize),
    clockBgColor: form.clockBgColor,
    timerBgColor: form.timerBgColor,
    dateLocation: form.dateLocation,
    timeFormat: form.timeFormat,
    timerEndBehavior: form.timerEndBehavior,
    overtimeAutoDismissSeconds: Number(form.overtimeAutoDismissSeconds),
    bgTransition: form.bgTransition,
    audioCues: stripUndefinedAudioCues(form.audioCues),
    displayContentFontSize: Number(form.displayContentFontSize),
    displayHeadingFontSize: Number(form.displayHeadingFontSize),
  };
}

export function ClockSettingsSection({ classId }: ClockSettingsSectionProps) {
  const { t } = useTranslation("classroomScreen");
  const { data: settings, isPending: settingsPending } = useClassroomSettings(classId);
  const { data: audioFiles = [] } = useClassroomAudioFiles(classId);
  const upsertSettings = useUpsertClassroomSettings();

  const audioOptions = getAllAudioOptions(audioFiles, (key) => t(key));
  const urlMap = createAudioUrlMap(toAudioUrlList(audioFiles));
  const { preview } = useAudioPlayer(urlMap);

  const [form, setForm] = useState<ClockSettingsForm>(() =>
    formFromSettings(DEFAULT_CLOCK_SETTINGS),
  );
  const hydratedClassId = useRef<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (hydratedClassId.current === classId) return;
    hydratedClassId.current = classId;
    setForm(formFromSettings(settings));
  }, [settings, classId]);

  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    };
  }, []);

  const persist = (next: ClockSettingsForm, immediate = true) => {
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    const run = () => {
      void upsertSettings.mutateAsync(payloadFromForm(classId, next));
    };
    if (immediate) {
      run();
      return;
    }
    persistTimer.current = window.setTimeout(run, 400);
  };

  const patchForm = (patch: Partial<ClockSettingsForm>, immediate = true) => {
    const next = { ...form, ...patch };
    setForm(next);
    persist(next, immediate);
  };

  if (settingsPending && !settings) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("clockSizeLabel")}</Label>
          <Select
            value={form.clockSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ clockSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{namedSizeLabel(t, CLOCK_SIZE_OPTIONS, form.clockSize)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CLOCK_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(o.labelKey)} ({t("fontSizePx", { size: o.value })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("timeFormatLabel")}</Label>
          <Select
            value={form.timeFormat}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ timeFormat: v as "12h" | "24h" });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {form.timeFormat === "12h" ? t("timeFormat12h") : t("timeFormat24h")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">{t("timeFormat12h")}</SelectItem>
              <SelectItem value="24h">{t("timeFormat24h")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("dateSizeLabel")}</Label>
          <Select
            value={form.dateSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ dateSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{namedSizeLabel(t, DATE_SIZE_OPTIONS, form.dateSize)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(o.labelKey)} ({t("fontSizePx", { size: o.value })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("dateLocationLabel")}</Label>
          <Select
            value={form.dateLocation}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ dateLocation: v as "above" | "below" });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {form.dateLocation === "above" ? t("dateLocationAbove") : t("dateLocationBelow")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above">{t("dateLocationAbove")}</SelectItem>
              <SelectItem value="below">{t("dateLocationBelow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("clockBgColorLabel")}</Label>
          <ColorInput
            value={form.clockBgColor}
            onChange={(v) => patchForm({ clockBgColor: v }, false)}
            pickColorLabel={t("pickColor")}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("timerBgColor")}</Label>
          <ColorInput
            value={form.timerBgColor}
            onChange={(v) => patchForm({ timerBgColor: v }, false)}
            pickColorLabel={t("pickColor")}
          />
        </div>
      </div>

      <BgTransitionSelect
        value={form.bgTransition}
        onValueChange={(v) => patchForm({ bgTransition: v })}
        label={t("timerBgTransition")}
      />

      <div className="grid gap-2">
        <Label>{t("timerEndBehaviorLabel")}</Label>
        <Select
          value={form.timerEndBehavior}
          onValueChange={(v) => {
            if (v == null) return;
            patchForm({ timerEndBehavior: v as "countUp" | "hold" | "return" });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {form.timerEndBehavior === "countUp"
                ? t("timerEndBehaviorCountUp")
                : form.timerEndBehavior === "hold"
                  ? t("timerEndBehaviorHold")
                  : t("timerEndBehaviorReturn")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="countUp">{t("timerEndBehaviorCountUp")}</SelectItem>
            <SelectItem value="hold">{t("timerEndBehaviorHold")}</SelectItem>
            <SelectItem value="return">{t("timerEndBehaviorReturn")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-medium">{t("activeTimerSizesTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("activeTimerSizesDescription")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("currentTimeSizeLabel")}</Label>
          <Select
            value={form.currentTimeSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ currentTimeSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {namedSizeLabel(t, DATE_SIZE_OPTIONS, form.currentTimeSize)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(o.labelKey)} ({t("fontSizePx", { size: o.value })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("endTimeSizeLabel")}</Label>
          <Select
            value={form.endTimeSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ endTimeSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{namedSizeLabel(t, DATE_SIZE_OPTIONS, form.endTimeSize)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(o.labelKey)} ({t("fontSizePx", { size: o.value })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("timerTitleSizeLabel")}</Label>
          <Select
            value={form.timerTitleSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ timerTitleSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{namedSizeLabel(t, DATE_SIZE_OPTIONS, form.timerTitleSize)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DATE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t(o.labelKey)} ({t("fontSizePx", { size: o.value })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-medium">{t("displayContentTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("displayContentDescription")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("displayBodyFontSizeLabel")}</Label>
          <Select
            value={form.displayContentFontSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ displayContentFontSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{t("fontSizePx", { size: form.displayContentFontSize })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_FONT_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t("fontSizePx", { size: o.value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("displayHeadingFontSizeLabel")}</Label>
          <Select
            value={form.displayHeadingFontSize}
            onValueChange={(v) => {
              if (v == null) return;
              patchForm({ displayHeadingFontSize: v });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{t("fontSizePx", { size: form.displayHeadingFontSize })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_FONT_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {t("fontSizePx", { size: o.value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <AudioCuesEditor
        value={form.audioCues}
        files={audioOptions}
        onChange={(audioCues) => patchForm({ audioCues }, false)}
        onPreview={preview}
      />
    </div>
  );
}
