import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReleaseControl } from "@/components/release/ReleaseControl";
import {
  ResourceLinksField,
  type ResourceLinkFormValue,
} from "@/components/resources/ResourceLinksField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageDocumentAttachmentsField } from "@/components/upload/ImageDocumentAttachmentsField";
import { useImageDocumentAttachments } from "@/components/upload/useImageDocumentAttachments";
import { isSubmitOnModEnter } from "@/lib/announcements/tiptapExtensions";
import { coerceDueDateKeyForInput, normalizeDueDateKey } from "@/lib/dueDate/dueDateKey";
import { randomClientId } from "@/lib/optimistic";
import {
  msToDatetimeLocal,
  releaseModeFromDoc,
  releasePayloadFromForm,
  type ReleaseMode,
} from "@/lib/release/release";
import {
  MAX_TASK_ATTACHMENTS,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_NAME_LENGTH,
  MAX_TASK_PROCEDURE_STEP_LENGTH,
  type TaskDetail,
  type TaskListItem,
} from "@/lib/tasks/tasks";
import { createTaskClientFormSchema } from "../../../convex/lib/tasks/taskSchema";
import type { Id } from "../../../convex/_generated/dataModel";

export type TaskFormValues = {
  name: string;
  description?: string;
  dueDateKey?: string;
  attachmentFileIds: Array<Id<"files">>;
  procedureSteps: Array<{ key: string; body: string }>;
  resources: Array<{ key: string; url: string; label?: string }>;
  acceptLinkSubmissions: boolean;
  hiddenFromStudents: boolean;
  scheduledReleaseAt?: number;
};

type TaskFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  mode: "create" | "edit";
  initial?: TaskListItem | TaskDetail | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

type FormDefaults = {
  name: string;
  description: string;
  dueDateKey: string;
  procedureSteps: Array<{ key: string; body: string }>;
  resources: ResourceLinkFormValue[];
  acceptLinkSubmissions: boolean;
  releaseMode: ReleaseMode;
  scheduledReleaseAt: string;
};

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

function emptyProcedureStep() {
  return { key: randomClientId(), body: "" };
}

export function TaskFormCredenza({
  open,
  onOpenChange,
  classId,
  mode,
  initial,
  onSubmit,
}: TaskFormCredenzaProps) {
  const { t } = useTranslation("tasks");
  const {
    fileIds: attachmentFileIds,
    items: attachmentItems,
    reset: resetAttachments,
    onUploaded,
    onRemove,
  } = useImageDocumentAttachments(MAX_TASK_ATTACHMENTS);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  /** Key of a just-added procedure step whose textarea should grab focus on mount. */
  const pendingStepFocusKeyRef = useRef<string | null>(null);
  const attachmentFileIdsRef = useRef(attachmentFileIds);
  attachmentFileIdsRef.current = attachmentFileIds;

  const defaults = useMemo((): FormDefaults => {
    const scheduledReleaseAt =
      initial && "scheduledReleaseAt" in initial && initial.scheduledReleaseAt !== undefined
        ? msToDatetimeLocal(initial.scheduledReleaseAt)
        : "";
    return {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      dueDateKey: coerceDueDateKeyForInput(initial?.dueDateKey),
      procedureSteps:
        initial && "procedureSteps" in initial
          ? initial.procedureSteps.map((step) => ({ key: step.key, body: step.body }))
          : [],
      resources:
        initial && "resources" in initial
          ? initial.resources.map((resource) => ({
              key: resource.key,
              url: resource.url,
              label: resource.label ?? "",
            }))
          : [],
      acceptLinkSubmissions: initial?.acceptLinkSubmissions === true,
      releaseMode: initial ? releaseModeFromDoc(initial) : "released",
      scheduledReleaseAt,
    };
  }, [initial]);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(
    () =>
      createTaskClientFormSchema({
        nameRequired: t("nameRequired"),
        nameTooLong: t("nameTooLong", { max: MAX_TASK_NAME_LENGTH }),
        descriptionTooLong: t("descriptionTooLong", { max: MAX_TASK_DESCRIPTION_LENGTH }),
        attachmentsTooMany: t("attachmentsTooMany", { max: MAX_TASK_ATTACHMENTS }),
        procedureStepRequired: t("procedureStepRequired"),
        procedureStepTooLong: t("procedureStepTooLong", { max: MAX_TASK_PROCEDURE_STEP_LENGTH }),
        procedureStepsTooMany: t("procedureStepsTooMany"),
        resourceUrlInvalid: t("resourceUrlInvalid"),
        resourcesTooMany: t("resourcesTooMany"),
        resourceLabelTooLong: t("resourceLabelTooLong"),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse({
          ...value,
          attachmentFileIds: attachmentFileIdsRef.current,
        });
        if (result.success) return undefined;
        const fieldErrors: Partial<
          Record<
            | "name"
            | "description"
            | "dueDateKey"
            | "procedureSteps"
            | "resources"
            | "releaseMode"
            | "scheduledReleaseAt",
            string
          >
        > = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (
            key === "name" ||
            key === "description" ||
            key === "dueDateKey" ||
            key === "procedureSteps" ||
            key === "resources" ||
            key === "releaseMode" ||
            key === "scheduledReleaseAt"
          ) {
            fieldErrors[key] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse({
        ...value,
        attachmentFileIds: attachmentFileIdsRef.current,
      });
      const description = parsed.description.trim() || undefined;
      const trimmedDue = parsed.dueDateKey.trim();
      const dueDateKey = trimmedDue ? (normalizeDueDateKey(trimmedDue) ?? undefined) : undefined;
      let release;
      try {
        release = releasePayloadFromForm({
          releaseMode: value.releaseMode,
          scheduledReleaseAt: value.scheduledReleaseAt,
        });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
        return;
      }
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          name: parsed.name,
          description,
          dueDateKey,
          attachmentFileIds: attachmentFileIdsRef.current,
          procedureSteps: parsed.procedureSteps
            .map((step) => ({ key: step.key, body: step.body.trim() }))
            .filter((step) => step.body.length > 0),
          resources: parsed.resources
            .map((resource) => ({
              key: resource.key,
              url: resource.url.trim(),
              ...(resource.label.trim() ? { label: resource.label.trim() } : {}),
            }))
            .filter((resource) => resource.url.length > 0),
          acceptLinkSubmissions: value.acceptLinkSubmissions,
          ...release,
        });
      } catch (error) {
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    setSubmitError(null);
    form.reset(defaultsRef.current);
    resetAttachments(
      initial
        ? {
            attachmentFileIds: initial.attachmentFileIds,
            attachments: initial.attachments,
          }
        : null,
    );
  }, [open, form, initial, resetAttachments]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-h-[90vh] sm:max-w-2xl">
        <CredenzaHeader>
          <CredenzaTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="max-h-[min(70vh,36rem)] overflow-y-auto">
          <form
            id="task-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("nameLabel")}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        autoComplete="off"
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="description">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("descriptionLabel")}</FieldLabel>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (isSubmitOnModEnter(event)) {
                            event.preventDefault();
                            void form.handleSubmit();
                          }
                        }}
                        rows={3}
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="dueDateKey">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t("dueDateLabel")}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid || undefined}
                      />
                      {isInvalid ? (
                        <FieldError>{fieldErrorMessage(field.state.meta.errors)}</FieldError>
                      ) : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="procedureSteps" mode="array">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("procedureLabel")}</FieldLabel>
                    <FieldDescription>{t("procedureDescription")}</FieldDescription>
                    <div className="flex flex-col gap-3">
                      {field.state.value.map((step, index) => (
                        <div key={step.key} className="flex flex-col gap-2 rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <FieldLabel>
                              {t("procedureStepLabel", { number: index + 1 })}
                            </FieldLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("procedureRemoveStep")}
                              onClick={() => field.removeValue(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <form.Field name={`procedureSteps[${index}].body`}>
                            {(bodyField) => (
                              <Textarea
                                ref={(element) => {
                                  if (element && pendingStepFocusKeyRef.current === step.key) {
                                    pendingStepFocusKeyRef.current = null;
                                    element.focus();
                                  }
                                }}
                                value={bodyField.state.value}
                                placeholder={t("procedureStepPlaceholder")}
                                onChange={(event) => bodyField.handleChange(event.target.value)}
                                rows={2}
                              />
                            )}
                          </form.Field>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        onClick={() => {
                          const step = emptyProcedureStep();
                          pendingStepFocusKeyRef.current = step.key;
                          field.pushValue(step);
                        }}
                      >
                        <Plus className="size-4" />
                        {t("procedureAddStep")}
                      </Button>
                    </div>
                  </Field>
                )}
              </form.Field>

              <form.Field name="resources">
                {(field) => (
                  <ResourceLinksField items={field.state.value} onChange={field.handleChange} />
                )}
              </form.Field>

              <ImageDocumentAttachmentsField
                classId={classId}
                max={MAX_TASK_ATTACHMENTS}
                fileIds={attachmentFileIds}
                items={attachmentItems}
                onUploaded={onUploaded}
                onRemove={onRemove}
              />

              <form.Field name="acceptLinkSubmissions">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("acceptLinkSubmissionsLabel")}</FieldLabel>
                    <FieldDescription>{t("acceptLinkSubmissionsDescription")}</FieldDescription>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.state.value}
                        onCheckedChange={(checked) => field.handleChange(checked === true)}
                      />
                      {t("acceptLinkSubmissionsCheckbox")}
                    </label>
                  </Field>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => ({
                  releaseMode: state.values.releaseMode,
                  scheduledReleaseAt: state.values.scheduledReleaseAt,
                })}
              >
                {({ releaseMode, scheduledReleaseAt }) => (
                  <ReleaseControl
                    namespace="tasks"
                    mode={releaseMode}
                    scheduledReleaseAt={scheduledReleaseAt}
                    onModeChange={(next) => form.setFieldValue("releaseMode", next)}
                    onScheduledChange={(next) => form.setFieldValue("scheduledReleaseAt", next)}
                  />
                )}
              </form.Subscribe>
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button type="submit" form="task-form" className="flex-1">
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
