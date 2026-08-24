import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { AnnouncementEditor } from "@/components/announcements/AnnouncementEditor";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageDocumentAttachmentsField } from "@/components/upload/ImageDocumentAttachmentsField";
import { useImageDocumentAttachments } from "@/components/upload/useImageDocumentAttachments";
import {
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_TITLE_LENGTH,
  type Announcement,
} from "@/lib/announcements/announcements";
import { EMPTY_ANNOUNCEMENT_BODY_JSON } from "@/lib/announcements/tiptapExtensions";
import type { Id } from "../../../convex/_generated/dataModel";

type AnnouncementFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  mode: "create" | "edit";
  initial?: Announcement | null;
  onSubmit: (values: {
    title: string;
    bodyJson: string;
    attachmentFileIds: Array<Id<"files">>;
    isPublic: boolean;
  }) => Promise<void>;
};

type FormDefaults = {
  title: string;
  bodyJson: string;
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

export function AnnouncementFormCredenza({
  open,
  onOpenChange,
  classId,
  mode,
  initial,
  onSubmit,
}: AnnouncementFormCredenzaProps) {
  const { t } = useTranslation("announcements");
  const {
    fileIds: attachmentFileIds,
    items: attachmentItems,
    reset: resetAttachments,
    onUploaded,
    onRemove,
  } = useImageDocumentAttachments(MAX_ANNOUNCEMENT_ATTACHMENTS);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const attachmentFileIdsRef = useRef(attachmentFileIds);
  attachmentFileIdsRef.current = attachmentFileIds;

  const defaults = useMemo(
    (): FormDefaults => ({
      title: initial?.title ?? "",
      bodyJson: initial?.bodyJson ?? EMPTY_ANNOUNCEMENT_BODY_JSON,
    }),
    [initial],
  );
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t("titleRequired"))
          .max(
            MAX_ANNOUNCEMENT_TITLE_LENGTH,
            t("titleTooLong", { max: MAX_ANNOUNCEMENT_TITLE_LENGTH }),
          ),
        bodyJson: z.string(),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) return undefined;
        const fieldErrors: Partial<Record<"title" | "bodyJson", string>> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key === "title" || key === "bodyJson") {
            fieldErrors[key] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value);
      skipNextResetRef.current = true;
      onOpenChange(false);
      try {
        await onSubmit({
          title: parsed.title,
          bodyJson: parsed.bodyJson || EMPTY_ANNOUNCEMENT_BODY_JSON,
          attachmentFileIds: attachmentFileIdsRef.current,
          isPublic,
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
    resetAttachments(initial ?? null);
    setIsPublic(initial?.isPublic ?? false);
  }, [open, form, initial, resetAttachments]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-2xl">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="min-h-0 flex-1 overflow-y-auto">
          <form
            id="announcement-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="title">
                {(field) => {
                  const error = fieldErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="announcement-title">{t("titleLabel")}</FieldLabel>
                      <Input
                        id="announcement-title"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        maxLength={MAX_ANNOUNCEMENT_TITLE_LENGTH}
                        autoComplete="off"
                      />
                      {error ? <FieldError>{error}</FieldError> : null}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="bodyJson">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("bodyLabel")}</FieldLabel>
                    <AnnouncementEditor value={field.state.value} onChange={field.handleChange} />
                    <FieldDescription>{t("bodyLinkHint")}</FieldDescription>
                  </Field>
                )}
              </form.Field>

              <Field>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Label htmlFor="announcement-form-public">{t("publicLabel")}</Label>
                    <FieldDescription>{t("publicDescription")}</FieldDescription>
                  </div>
                  <Switch
                    id="announcement-form-public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
              </Field>

              <ImageDocumentAttachmentsField
                classId={classId}
                max={MAX_ANNOUNCEMENT_ATTACHMENTS}
                fileIds={attachmentFileIds}
                items={attachmentItems}
                onUploaded={onUploaded}
                onRemove={onRemove}
              />
            </FieldGroup>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </form>
        </CredenzaBody>
        <CredenzaFooter className="shrink-0">
          <CredenzaClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button type="submit" form="announcement-form">
            {mode === "create" ? t("createAction") : t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
