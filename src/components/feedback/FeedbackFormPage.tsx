import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FileDropzone } from "@/components/upload/FileDropzone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProgressButton } from "@/components/ui/progress-button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeedback } from "@/hooks/feedback/useSubmitFeedback";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createFeedbackFormSchema,
  emptyFeedbackFormValues,
  feedbackArgsFromForm,
  FEEDBACK_IMPORTANCES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_TYPES,
  MAX_FEEDBACK_ATTACHMENTS,
  MAX_FEEDBACK_BODY_LENGTH,
  MAX_FEEDBACK_TITLE_LENGTH,
  type FeedbackType,
} from "@/lib/feedback/feedbackFormSchema";
import { cn } from "@/lib/utils";

const SUCCESS_DURATION_MS = 750;

const SUCCESS_CLASSNAME =
  "border-green-600 bg-[color-mix(in_oklab,var(--background)_80%,var(--color-green-500)_20%)] text-green-700 hover:bg-[color-mix(in_oklab,var(--background)_80%,var(--color-green-500)_20%)] hover:text-green-700 dark:border-green-400 dark:text-green-400 dark:hover:text-green-400";

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

export function FeedbackFormPage() {
  const { t, i18n } = useTranslation("feedback");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <FeedbackForm key={i18n.language} />
    </div>
  );
}

function FeedbackForm() {
  const { t } = useTranslation("feedback");
  const { data: user } = useCurrentUser();
  const submitFeedback = useSubmitFeedback();
  const [attachmentFileIds, setAttachmentFileIds] = useState<Id<"files">[]>([]);
  const [submittedFlash, setSubmittedFlash] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropzoneKeyRef = useRef(0);
  const [dropzoneKey, setDropzoneKey] = useState(0);

  const feedbackFormSchema = useMemo(
    () =>
      createFeedbackFormSchema({
        titleRequired: t("titleRequired"),
        titleTooLong: t("titleTooLong", { max: MAX_FEEDBACK_TITLE_LENGTH }),
        bodyRequired: t("bodyRequired"),
        bodyTooLong: t("bodyTooLong", { max: MAX_FEEDBACK_BODY_LENGTH }),
        severityRequired: t("severityRequired"),
      }),
    [t],
  );

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const form = useForm({
    defaultValues: emptyFeedbackFormValues(),
    validators: {
      onSubmit: feedbackFormSchema,
    },
    onSubmit: async ({ value }) => {
      const args = feedbackArgsFromForm(value);
      await submitFeedback.mutateAsync({
        ...args,
        attachmentFileIds,
      });
      setSubmittedFlash(true);
      if (successTimeoutRef.current !== null) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSubmittedFlash(false);
        successTimeoutRef.current = null;
      }, SUCCESS_DURATION_MS);
      form.reset(emptyFeedbackFormValues());
      setAttachmentFileIds([]);
      dropzoneKeyRef.current += 1;
      setDropzoneKey(dropzoneKeyRef.current);
    },
  });

  const onUploaded = useCallback((fileId: Id<"files">) => {
    setAttachmentFileIds((prev) => {
      if (prev.includes(fileId) || prev.length >= MAX_FEEDBACK_ATTACHMENTS) {
        return prev;
      }
      return [...prev, fileId];
    });
  }, []);

  const pending = submitFeedback.isPending;
  const progress = pending ? 85 : 0;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="type">
          {(field) => (
            <Field>
              <FieldLabel>{t("typeLabel")}</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(next) => {
                  if (typeof next === "string" && FEEDBACK_TYPES.includes(next as FeedbackType)) {
                    field.handleChange(next as FeedbackType);
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue>{t(`type_${field.state.value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FEEDBACK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`type_${type}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="title">
          {(field) => {
            const error = fieldErrorMessage(field.state.meta.errors);
            return (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="feedback-title">{t("titleLabel")}</FieldLabel>
                <Input
                  id="feedback-title"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t("titlePlaceholder")}
                  aria-invalid={error ? true : undefined}
                />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="body">
          {(field) => {
            const error = fieldErrorMessage(field.state.meta.errors);
            return (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="feedback-body">{t("bodyLabel")}</FieldLabel>
                <Textarea
                  id="feedback-body"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t("bodyPlaceholder")}
                  rows={5}
                  aria-invalid={error ? true : undefined}
                />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.type}>
          {(type) => (
            <>
              {type === "bug" ? (
                <>
                  <form.Field name="stepsToReproduce">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="feedback-steps">{t("stepsLabel")}</FieldLabel>
                        <Textarea
                          id="feedback-steps"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("stepsPlaceholder")}
                          rows={3}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="expected">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="feedback-expected">{t("expectedLabel")}</FieldLabel>
                        <Textarea
                          id="feedback-expected"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("expectedPlaceholder")}
                          rows={2}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="actual">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="feedback-actual">{t("actualLabel")}</FieldLabel>
                        <Textarea
                          id="feedback-actual"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("actualPlaceholder")}
                          rows={2}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="severity">
                    {(field) => {
                      const error = fieldErrorMessage(field.state.meta.errors);
                      return (
                        <Field data-invalid={error ? true : undefined}>
                          <FieldLabel>{t("severityLabel")}</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(next) => {
                              if (
                                typeof next === "string" &&
                                FEEDBACK_SEVERITIES.includes(
                                  next as (typeof FEEDBACK_SEVERITIES)[number],
                                )
                              ) {
                                field.handleChange(next as (typeof FEEDBACK_SEVERITIES)[number]);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full rounded-lg">
                              <SelectValue>
                                {field.state.value
                                  ? t(`severity_${field.state.value}`)
                                  : t("severityPlaceholder")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {FEEDBACK_SEVERITIES.map((severity) => (
                                  <SelectItem key={severity} value={severity}>
                                    {t(`severity_${severity}`)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {error ? <FieldError>{error}</FieldError> : null}
                        </Field>
                      );
                    }}
                  </form.Field>
                </>
              ) : null}

              {type === "feature" ? (
                <>
                  <form.Field name="useCase">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="feedback-usecase">{t("useCaseLabel")}</FieldLabel>
                        <Textarea
                          id="feedback-usecase"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("useCasePlaceholder")}
                          rows={3}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="proposedSolution">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="feedback-proposed">
                          {t("proposedSolutionLabel")}
                        </FieldLabel>
                        <Textarea
                          id="feedback-proposed"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("proposedSolutionPlaceholder")}
                          rows={3}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="importance">
                    {(field) => (
                      <Field>
                        <FieldLabel>{t("importanceLabel")}</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(next) => {
                            if (
                              typeof next === "string" &&
                              FEEDBACK_IMPORTANCES.includes(
                                next as (typeof FEEDBACK_IMPORTANCES)[number],
                              )
                            ) {
                              field.handleChange(next as (typeof FEEDBACK_IMPORTANCES)[number]);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full rounded-lg">
                            <SelectValue>
                              {field.state.value
                                ? t(`importance_${field.state.value}`)
                                : t("importancePlaceholder")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {FEEDBACK_IMPORTANCES.map((importance) => (
                                <SelectItem key={importance} value={importance}>
                                  {t(`importance_${importance}`)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>
                </>
              ) : null}

              {type === "concern" ? (
                <form.Field name="impact">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="feedback-impact">{t("impactLabel")}</FieldLabel>
                      <Textarea
                        id="feedback-impact"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder={t("impactPlaceholder")}
                        rows={3}
                      />
                    </Field>
                  )}
                </form.Field>
              ) : null}
            </>
          )}
        </form.Subscribe>

        <Field>
          <FieldLabel>{t("attachmentsLabel")}</FieldLabel>
          <FieldDescription>
            {t("attachmentsDescription", { max: MAX_FEEDBACK_ATTACHMENTS })}
          </FieldDescription>
          {attachmentFileIds.length < MAX_FEEDBACK_ATTACHMENTS ? (
            <FileDropzone
              key={dropzoneKey}
              presetKey="images"
              variant="compact"
              multiple
              title={t("attachmentsDropzone")}
              onUploaded={onUploaded}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("attachmentsMaxReached")}</p>
          )}
          {attachmentFileIds.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("attachmentsCount", { count: attachmentFileIds.length })}
            </p>
          ) : null}
        </Field>

        <form.Field name="wantReply">
          {(field) => (
            <Field>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="feedback-want-reply"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="feedback-want-reply" className="font-normal">
                    {t("wantReplyLabel")}
                  </FieldLabel>
                  {field.state.value && user?.email ? (
                    <FieldDescription>
                      {t("wantReplyEmailHint", { email: user.email })}
                    </FieldDescription>
                  ) : (
                    <FieldDescription>{t("wantReplyDescription")}</FieldDescription>
                  )}
                </div>
              </div>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      {pending ? (
        <ProgressButton type="submit" progress={progress} pending className="w-full" disabled>
          {t("submitting")}
        </ProgressButton>
      ) : (
        <Button
          type="submit"
          className={cn("w-full", submittedFlash && SUCCESS_CLASSNAME)}
          disabled={submittedFlash}
        >
          {submittedFlash ? (
            <span className="inline-flex items-center gap-2">
              <CheckIcon className="size-4 animate-in fade-in-0 zoom-in-95 duration-200" />
              {t("submitted")}
            </span>
          ) : (
            t("submit")
          )}
        </Button>
      )}
    </form>
  );
}
