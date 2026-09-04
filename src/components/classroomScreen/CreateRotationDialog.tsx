import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import {
  useCreateClassroomRotation,
  useUpdateClassroomRotation,
} from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  useClassroomAudioFiles,
  type ClassroomRotation,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createRotationFormSchema,
  DEFAULT_NUMBER_OF_ROTATIONS,
  DEFAULT_ROTATION_BG_COLOR,
  DEFAULT_TRANSITION_BG_COLOR,
  type RotationFormMessages,
  type RotationFormValues,
} from "../../../convex/lib/classroomScreen/rotationSchema";
import { createAudioUrlMap, useAudioPlayer } from "@/lib/classroomScreen/audio-engine";
import { getAllAudioOptions, toAudioUrlList } from "@/lib/classroomScreen/audioOptions";
import type { AudioCues } from "@/lib/classroomScreen/audioCues";
import { stripUndefinedAudioCues } from "@/lib/classroomScreen/audioCues";
import { BG_TRANSITION_GLOBAL_VALUE } from "@/lib/classroomScreen/bgTransitions";
import { secondsToDurationParts } from "@/lib/classroomScreen/timerUtils";
import { messageFromError } from "@/lib/errors/convexError";

interface CreateRotationDialogProps {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rotation?: ClassroomRotation | null;
}

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function defaultFormValues(): RotationFormValues {
  return {
    name: "",
    rotationDuration: "5",
    rotationDurationUnit: "minutes",
    numberOfRotations: DEFAULT_NUMBER_OF_ROTATIONS,
    transitionDuration: "30",
    transitionDurationUnit: "seconds",
    rotationBgColor: DEFAULT_ROTATION_BG_COLOR,
    transitionBgColor: DEFAULT_TRANSITION_BG_COLOR,
    finalTransition: false,
    bgTransition: BG_TRANSITION_GLOBAL_VALUE,
    audioCues: {},
    workCues: {},
    transitionCues: {},
  };
}

function valuesFromRotation(rotation: ClassroomRotation): RotationFormValues {
  const work = secondsToDurationParts(rotation.rotationDurationSeconds);
  const transition = secondsToDurationParts(rotation.transitionDurationSeconds);
  return {
    name: rotation.name,
    rotationDuration: work.value,
    rotationDurationUnit: work.unit,
    numberOfRotations: rotation.numberOfRotations,
    transitionDuration: transition.value,
    transitionDurationUnit: transition.unit,
    rotationBgColor: rotation.rotationBgColor,
    transitionBgColor: rotation.transitionBgColor,
    finalTransition: rotation.finalTransition ?? false,
    bgTransition: rotation.bgTransition ?? BG_TRANSITION_GLOBAL_VALUE,
    audioCues: (rotation.audioCues as AudioCues | undefined) ?? {},
    workCues: (rotation.workCues as AudioCues | undefined) ?? {},
    transitionCues: (rotation.transitionCues as AudioCues | undefined) ?? {},
  };
}

export function CreateRotationDialog({
  classId,
  open,
  onOpenChange,
  rotation,
}: CreateRotationDialogProps) {
  const { t } = useTranslation("classroomScreen");
  const { data: audioData } = useClassroomAudioFiles(classId);
  const createRotation = useCreateClassroomRotation();
  const updateRotation = useUpdateClassroomRotation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);

  const audioFiles = audioData ?? [];
  const audioOptions = getAllAudioOptions(audioFiles, (key) => t(key));
  const urlMap = createAudioUrlMap(toAudioUrlList(audioFiles));
  const { preview } = useAudioPlayer(urlMap);

  const isEditing = rotation != null;
  const defaults = useMemo(
    () => (rotation ? valuesFromRotation(rotation) : defaultFormValues()),
    [rotation],
  );

  const messages = useMemo(
    (): RotationFormMessages => ({
      nameRequired: t("rotationNameRequired"),
      nameTooLong: t("rotationNameTooLong"),
      durationInvalid: t("rotationDurationInvalid"),
      transitionDurationInvalid: t("rotationTransitionDurationInvalid"),
      countInvalid: t("rotationCountInvalid"),
      colorInvalid: t("rotationColorInvalid"),
    }),
    [t],
  );
  const schema = useMemo(() => createRotationFormSchema(messages), [messages]);

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path[0];
          if (typeof path !== "string") continue;
          form.setFieldMeta(path as keyof RotationFormValues, (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onSubmit: issue.message },
            errors: [issue.message],
          }));
        }
        return;
      }

      setSubmitError(null);
      onOpenChange(false);
      const payload = {
        classId,
        name: parsed.data.name,
        rotationDurationSeconds: parsed.data.rotationDurationSeconds,
        numberOfRotations: parsed.data.numberOfRotations,
        transitionDurationSeconds: parsed.data.transitionDurationSeconds,
        rotationBgColor: parsed.data.rotationBgColor,
        transitionBgColor: parsed.data.transitionBgColor,
        finalTransition: parsed.data.finalTransition,
        bgTransition: parsed.data.bgTransition,
        audioCues: stripUndefinedAudioCues(parsed.data.audioCues ?? {}),
        workCues: stripUndefinedAudioCues(parsed.data.workCues ?? {}),
        transitionCues: stripUndefinedAudioCues(parsed.data.transitionCues ?? {}),
      };

      try {
        if (isEditing && rotation) {
          await updateRotation.mutateAsync({
            ...payload,
            rotationId: rotation._id,
            bgTransition: payload.bgTransition ?? null,
          });
        } else {
          await createRotation.mutateAsync(payload);
        }
      } catch (error) {
        skipNextResetRef.current = true;
        onOpenChange(true);
        setSubmitError(messageFromError(error, t("rotationSaveError")));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    form.reset(defaults);
    setSubmitError(null);
  }, [open, defaults, form]);

  const isSubmitting = createRotation.isPending || updateRotation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("rotationEditTitle") : t("rotationCreateTitle")}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? t("rotationEditDescription") : t("rotationCreateDescription")}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto py-2">
            <form.Field name="name">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="rotation-name">{t("rotationName")}</FieldLabel>
                    <Input
                      id="rotation-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder={t("rotationNamePlaceholder")}
                      autoComplete="off"
                      aria-invalid={error ? true : undefined}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="rotationDuration">
              {(durationField) => (
                <form.Field name="rotationDurationUnit">
                  {(unitField) => {
                    const error = fieldErrorMessage(durationField.state.meta.errors);
                    return (
                      <Field data-invalid={error ? true : undefined}>
                        <FieldLabel>{t("rotationDuration")}</FieldLabel>
                        <DurationInput
                          value={durationField.state.value}
                          unit={unitField.state.value}
                          onValueChange={durationField.handleChange}
                          onUnitChange={(unit: DurationUnit) => unitField.handleChange(unit)}
                          min={0}
                          secondsLabel={t("durationSeconds")}
                          minutesLabel={t("durationMinutes")}
                        />
                        {error ? <FieldError>{error}</FieldError> : null}
                      </Field>
                    );
                  }}
                </form.Field>
              )}
            </form.Field>

            <form.Field name="numberOfRotations">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="rotation-count">{t("rotationCount")}</FieldLabel>
                    <NumberInput
                      id="rotation-count"
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      min={1}
                      max={48}
                      step={1}
                      aria-invalid={error ? true : undefined}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="transitionDuration">
              {(durationField) => (
                <form.Field name="transitionDurationUnit">
                  {(unitField) => {
                    const error = fieldErrorMessage(durationField.state.meta.errors);
                    return (
                      <Field data-invalid={error ? true : undefined}>
                        <FieldLabel>{t("rotationTransitionDuration")}</FieldLabel>
                        <DurationInput
                          value={durationField.state.value}
                          unit={unitField.state.value}
                          onValueChange={durationField.handleChange}
                          onUnitChange={(unit: DurationUnit) => unitField.handleChange(unit)}
                          min={0}
                          secondsLabel={t("durationSeconds")}
                          minutesLabel={t("durationMinutes")}
                        />
                        {error ? <FieldError>{error}</FieldError> : null}
                      </Field>
                    );
                  }}
                </form.Field>
              )}
            </form.Field>

            <form.Field name="rotationBgColor">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel>{t("rotationBgColor")}</FieldLabel>
                    <ColorInput
                      value={field.state.value}
                      onChange={field.handleChange}
                      pickColorLabel={t("pickColor")}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="transitionBgColor">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel>{t("rotationTransitionBgColor")}</FieldLabel>
                    <ColorInput
                      value={field.state.value}
                      onChange={field.handleChange}
                      pickColorLabel={t("pickColor")}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="finalTransition">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="rotation-final-transition">
                    {t("rotationFinalTransition")}
                  </FieldLabel>
                  <Switch
                    id="rotation-final-transition"
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="bgTransition">
              {(field) => (
                <BgTransitionSelect
                  id="rotation-bg-transition"
                  label={t("timerBgTransition")}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  showGlobalOption
                  globalOptionLabel={t("bgTransitionGlobal")}
                />
              )}
            </form.Field>

            <OptionalCollapsible title={t("rotationSounds")}>
              <form.Field name="audioCues">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("rotationSessionSounds")}</FieldLabel>
                    <AudioCuesEditor
                      value={field.state.value}
                      files={audioOptions}
                      allowInherit
                      onChange={field.handleChange}
                      onPreview={preview}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="workCues">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("rotationWorkSounds")}</FieldLabel>
                    <AudioCuesEditor
                      value={field.state.value}
                      files={audioOptions}
                      allowInherit
                      onChange={field.handleChange}
                      onPreview={preview}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="transitionCues">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("rotationTransitionSounds")}</FieldLabel>
                    <AudioCuesEditor
                      value={field.state.value}
                      files={audioOptions}
                      allowInherit
                      onChange={field.handleChange}
                      onPreview={preview}
                    />
                  </Field>
                )}
              </form.Field>
            </OptionalCollapsible>
          </FieldGroup>

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
                  : t("createRotation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
