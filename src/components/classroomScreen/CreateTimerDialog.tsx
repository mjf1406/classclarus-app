import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AudioCuesEditor } from "@/components/classroomScreen/AudioCuesEditor";
import { BgTransitionSelect } from "@/components/classroomScreen/BgTransitionSelect";
import { OptionalCollapsible } from "@/components/classroomScreen/OptionalCollapsible";
import { Button } from "@/components/ui/button";
import { ColorInput } from "@/components/ui/color-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DurationInput, type DurationUnit } from "@/components/ui/duration-input";
import { durationToSeconds } from "@/lib/classroomScreen/durationInputUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useCreateClassroomTimer,
  useUpdateClassroomTimer,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  useClassroomAudioFiles,
  useClassroomTimers,
  type ClassroomTimer,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import { useClass } from "@/hooks/classes/useClass";
import { resolveClassTimeZone } from "../../../convex/lib/calendar/timeZone";
import type { Id } from "../../../convex/_generated/dataModel";
import { createAudioUrlMap, useAudioPlayer } from "@/lib/classroomScreen/audio-engine";
import { getAllAudioOptions, toAudioUrlList } from "@/lib/classroomScreen/audioOptions";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import { stripUndefinedAudioCues } from "@/lib/classroomScreen/audioCues";
import { BG_TRANSITION_GLOBAL_VALUE } from "@/lib/classroomScreen/bgTransitions";
import {
  normalizeEndTime,
  secondsToDurationParts,
  secondsUntilEndTime,
} from "@/lib/classroomScreen/timerUtils";
import { messageFromError } from "@/lib/errors/convexError";

interface CreateTimerDialogProps {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timer?: ClassroomTimer | null;
}

const NO_NEXT_TIMER = "__none__";

const defaultFormState = {
  name: "",
  duration: "5",
  durationUnit: "minutes" as DurationUnit,
  bgColor: "#15803d",
  useEndTime: false,
  endTime: "12:00:00",
  bgTransition: BG_TRANSITION_GLOBAL_VALUE,
  nextTimerId: NO_NEXT_TIMER,
  audioCues: {} as AudioCues,
};

export function CreateTimerDialog({ classId, open, onOpenChange, timer }: CreateTimerDialogProps) {
  const { t } = useTranslation("classroomScreen");
  const { data: audioData } = useClassroomAudioFiles(classId);
  const { data: timersData } = useClassroomTimers(classId);
  const { data: classDoc } = useClass(classId);
  const timeZone = resolveClassTimeZone(classDoc?.timezone);
  const createTimer = useCreateClassroomTimer();
  const updateTimer = useUpdateClassroomTimer();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const audioFiles = audioData ?? [];
  const allTimers = timersData ?? [];
  const audioOptions = getAllAudioOptions(audioFiles, (key) => t(key));
  const urlMap = createAudioUrlMap(toAudioUrlList(audioFiles));
  const { preview } = useAudioPlayer(urlMap);

  const [name, setName] = useState(defaultFormState.name);
  const [duration, setDuration] = useState(defaultFormState.duration);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(defaultFormState.durationUnit);
  const [bgColor, setBgColor] = useState(defaultFormState.bgColor);
  const [useEndTime, setUseEndTime] = useState(defaultFormState.useEndTime);
  const [endTime, setEndTime] = useState(defaultFormState.endTime);
  const [bgTransition, setBgTransition] = useState(defaultFormState.bgTransition);
  const [nextTimerId, setNextTimerId] = useState(defaultFormState.nextTimerId);
  const [audioCues, setAudioCues] = useState<AudioCues>(defaultFormState.audioCues);

  const isEditing = timer != null;
  const nextTimerOptions = allTimers.filter(
    (candidate) => !isEditing || candidate._id !== timer?._id,
  );

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }

    setSubmitError(null);

    if (timer) {
      setName(timer.name);
      setBgColor(timer.bgColor);
      setBgTransition(timer.bgTransition ?? BG_TRANSITION_GLOBAL_VALUE);
      setNextTimerId(timer.nextTimerId ?? NO_NEXT_TIMER);
      setAudioCues((timer.audioCues as AudioCues) ?? {});
      if (timer.endTime) {
        setUseEndTime(true);
        setEndTime(normalizeEndTime(timer.endTime));
      } else {
        setUseEndTime(false);
        const parts = secondsToDurationParts(timer.durationSeconds);
        setDuration(parts.value);
        setDurationUnit(parts.unit);
      }
    } else {
      setName(defaultFormState.name);
      setDuration(defaultFormState.duration);
      setDurationUnit(defaultFormState.durationUnit);
      setBgColor(defaultFormState.bgColor);
      setUseEndTime(defaultFormState.useEndTime);
      setEndTime(defaultFormState.endTime);
      setBgTransition(defaultFormState.bgTransition);
      setNextTimerId(defaultFormState.nextTimerId);
      setAudioCues(defaultFormState.audioCues);
    }
  }, [open, timer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const durationSeconds = useEndTime
      ? secondsUntilEndTime(endTime, timeZone)
      : durationToSeconds(duration, durationUnit);

    const sharedPayload = {
      classId,
      name: name.trim(),
      durationSeconds,
      bgColor,
      endTime: useEndTime ? endTime : undefined,
      bgTransition: bgTransition === BG_TRANSITION_GLOBAL_VALUE ? undefined : bgTransition,
      audioCues: stripUndefinedAudioCues(audioCues),
      nextTimerId:
        nextTimerId == null || nextTimerId === NO_NEXT_TIMER
          ? undefined
          : (nextTimerId as Id<"classroomTimers">),
    };

    setSubmitError(null);
    onOpenChange(false);

    try {
      if (isEditing && timer) {
        await updateTimer.mutateAsync({
          ...sharedPayload,
          timerId: timer._id,
        });
      } else {
        await createTimer.mutateAsync(sharedPayload);
      }
    } catch (error) {
      skipNextResetRef.current = true;
      onOpenChange(true);
      setSubmitError(messageFromError(error, t("timerSaveError")));
    }
  };

  const isSubmitting = createTimer.isPending || updateTimer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("timerEditTitle") : t("timerCreateTitle")}</DialogTitle>
            <DialogDescription>
              {isEditing ? t("timerEditDescription") : t("timerCreateDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto py-2">
            <div className="grid gap-2">
              <Label htmlFor="timer-name">{t("timerName")}</Label>
              <Input
                id="timer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("timerNamePlaceholder")}
                required
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="use-end-time" className="flex-1">
                {t("timerUseEndTime")}
              </Label>
              <Switch id="use-end-time" checked={useEndTime} onCheckedChange={setUseEndTime} />
            </div>

            {useEndTime ? (
              <div className="grid gap-2">
                <Label htmlFor="end-time">{t("timerEndTime")}</Label>
                <Input
                  id="end-time"
                  type="time"
                  step={1}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>{t("timerDuration")}</Label>
                <DurationInput
                  value={duration}
                  unit={durationUnit}
                  onValueChange={setDuration}
                  onUnitChange={setDurationUnit}
                  min={0}
                  secondsLabel={t("durationSeconds")}
                  minutesLabel={t("durationMinutes")}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>{t("timerBgColor")}</Label>
              <ColorInput value={bgColor} onChange={setBgColor} pickColorLabel={t("pickColor")} />
            </div>

            <BgTransitionSelect
              id="timer-bg-transition"
              label={t("timerBgTransition")}
              value={bgTransition}
              onValueChange={setBgTransition}
              showGlobalOption
              globalOptionLabel={t("bgTransitionGlobal")}
            />

            <div className="grid gap-2">
              <Label>{t("timerAutoPlayNext")}</Label>
              <Select value={nextTimerId} onValueChange={(v) => v && setNextTimerId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {nextTimerId === NO_NEXT_TIMER
                      ? t("timerNone")
                      : (nextTimerOptions.find((candidate) => candidate._id === nextTimerId)
                          ?.name ?? t("timerNone"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_NEXT_TIMER}>{t("timerNone")}</SelectItem>
                  {nextTimerOptions.map((candidate) => (
                    <SelectItem key={candidate._id} value={candidate._id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <OptionalCollapsible title={t("timerSounds")}>
              <AudioCuesEditor
                value={audioCues}
                files={audioOptions}
                allowInherit
                onChange={setAudioCues}
                onPreview={preview}
              />
            </OptionalCollapsible>
          </div>

          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? t("saving")
                  : t("creating")
                : isEditing
                  ? t("saveChanges")
                  : t("createTimer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
