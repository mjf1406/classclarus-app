import type { DragEndEvent } from "@dnd-kit/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { AssignmentInstructionsEditor } from "@/components/assignments/AssignmentInstructionsEditor";
import { reorderByKey } from "@/components/assignments/assignmentFormReorder";
import {
  SortableFormItem,
  SortableVerticalList,
} from "@/components/assignments/AssignmentFormSortable";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  rowFocusKeyProps,
  rowFocusTargetProps,
  usePendingRowFocus,
} from "@/hooks/usePendingRowFocus";
import { useCreateAssignment } from "@/hooks/assignments/useCreateAssignment";
import { useUpdateAssignment } from "@/hooks/assignments/useUpdateAssignment";
import { useExpectations } from "@/hooks/expectations/useExpectations";
import {
  assignmentFormValuesFromDetail,
  assignmentMutationPayloadFromForm,
  createEmptyProcedureStep,
  createEmptyRubricEntry,
  createEmptySection,
  emptyAssignmentFormValues,
  MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH,
  MAX_ASSIGNMENT_NAME_LENGTH,
  MAX_ASSIGNMENT_PROCEDURE_STEP_LENGTH,
  MAX_ASSIGNMENT_SECTION_NAME_LENGTH,
  MAX_ASSIGNMENT_SUBJECT_LENGTH,
  MAX_ASSIGNMENT_UNIT_LENGTH,
  type AssignmentDetail,
  type AssignmentFormValues,
  type AssignmentSectionType,
} from "@/lib/assignments/assignments";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignmentFormPageProps = {
  classId: Id<"classes">;
  mode: "create" | "edit";
  initial?: AssignmentDetail | null;
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

function scrollToFormError(submitErrorEl: HTMLElement | null) {
  const firstInvalid = document.querySelector<HTMLElement>("[data-invalid='true']");
  const target = firstInvalid ?? submitErrorEl;
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = firstInvalid?.querySelector<HTMLElement>(
    "input, textarea, select, button, [tabindex]:not([tabindex='-1'])",
  );
  focusable?.focus({ preventScroll: true });
}

export function AssignmentFormPage({ classId, mode, initial }: AssignmentFormPageProps) {
  const { t } = useTranslation("assignments");
  const navigate = useNavigate();
  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const { data: expectations } = useExpectations(classId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [collapsedSectionKeys, setCollapsedSectionKeys] = useState<Set<string>>(() => new Set());
  const submitErrorRef = useRef<HTMLParagraphElement>(null);
  const { queueRowFocus } = usePendingRowFocus();

  const defaults = useMemo(
    () => (initial ? assignmentFormValuesFromDetail(initial) : emptyAssignmentFormValues()),
    [initial],
  );

  const schema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1, t("nameRequired"))
            .max(MAX_ASSIGNMENT_NAME_LENGTH, t("nameTooLong", { max: MAX_ASSIGNMENT_NAME_LENGTH })),
          subject: z
            .string()
            .max(
              MAX_ASSIGNMENT_SUBJECT_LENGTH,
              t("subjectTooLong", { max: MAX_ASSIGNMENT_SUBJECT_LENGTH }),
            ),
          unit: z
            .string()
            .max(MAX_ASSIGNMENT_UNIT_LENGTH, t("unitTooLong", { max: MAX_ASSIGNMENT_UNIT_LENGTH })),
          dueDateKey: z.string(),
          instructionsJson: z.string(),
          scoringMode: z.enum(["total", "sections"]),
          totalPoints: z.number().min(0),
          sections: z.array(
            z.object({
              key: z.string(),
              name: z.string(),
              type: z.enum(["points", "rubricLevels", "rubricCheckboxes"]),
              maxPoints: z.number().min(0),
              levels: z.array(
                z.object({
                  key: z.string(),
                  description: z.string(),
                  points: z.number().min(0),
                }),
              ),
              items: z.array(
                z.object({
                  key: z.string(),
                  description: z.string(),
                  points: z.number().min(0),
                }),
              ),
            }),
          ),
          procedureSteps: z.array(
            z.object({
              key: z.string(),
              body: z.string(),
              addAsTask: z.boolean(),
              taskId: z.string().optional(),
            }),
          ),
          expectationIds: z.array(z.string()),
          acceptLinkSubmissions: z.boolean(),
        })
        .superRefine((value, ctx) => {
          if (value.scoringMode === "sections") {
            if (value.sections.length === 0) {
              ctx.addIssue({
                code: "custom",
                path: ["sections"],
                message: t("sectionRequired"),
              });
            }
            value.sections.forEach((section, index) => {
              if (!section.name.trim()) {
                ctx.addIssue({
                  code: "custom",
                  path: ["sections", index, "name"],
                  message: t("sectionNameRequired"),
                });
              } else if (section.name.trim().length > MAX_ASSIGNMENT_SECTION_NAME_LENGTH) {
                ctx.addIssue({
                  code: "custom",
                  path: ["sections", index, "name"],
                  message: t("nameTooLong", { max: MAX_ASSIGNMENT_SECTION_NAME_LENGTH }),
                });
              }
              if (section.type === "rubricLevels") {
                if (section.levels.length === 0) {
                  ctx.addIssue({
                    code: "custom",
                    path: ["sections", index, "levels"],
                    message: t("levelRequired"),
                  });
                }
                section.levels.forEach((level, levelIndex) => {
                  if (!level.description.trim()) {
                    ctx.addIssue({
                      code: "custom",
                      path: ["sections", index, "levels", levelIndex, "description"],
                      message: t("levelDescriptionRequired"),
                    });
                  } else if (
                    level.description.trim().length > MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH
                  ) {
                    ctx.addIssue({
                      code: "custom",
                      path: ["sections", index, "levels", levelIndex, "description"],
                      message: t("procedureStepTooLong", {
                        max: MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH,
                      }),
                    });
                  }
                });
              }
              if (section.type === "rubricCheckboxes") {
                if (section.items.length === 0) {
                  ctx.addIssue({
                    code: "custom",
                    path: ["sections", index, "items"],
                    message: t("checkboxRequired"),
                  });
                }
                section.items.forEach((item, itemIndex) => {
                  if (!item.description.trim()) {
                    ctx.addIssue({
                      code: "custom",
                      path: ["sections", index, "items", itemIndex, "description"],
                      message: t("checkboxDescriptionRequired"),
                    });
                  } else if (
                    item.description.trim().length > MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH
                  ) {
                    ctx.addIssue({
                      code: "custom",
                      path: ["sections", index, "items", itemIndex, "description"],
                      message: t("procedureStepTooLong", {
                        max: MAX_ASSIGNMENT_LEVEL_DESCRIPTION_LENGTH,
                      }),
                    });
                  }
                });
              }
            });
          }
          value.procedureSteps.forEach((step, index) => {
            if (!step.body.trim()) {
              ctx.addIssue({
                code: "custom",
                path: ["procedureSteps", index, "body"],
                message: t("procedureStepRequired"),
              });
            } else if (step.body.trim().length > MAX_ASSIGNMENT_PROCEDURE_STEP_LENGTH) {
              ctx.addIssue({
                code: "custom",
                path: ["procedureSteps", index, "body"],
                message: t("procedureStepTooLong", {
                  max: MAX_ASSIGNMENT_PROCEDURE_STEP_LENGTH,
                }),
              });
            }
          });
        }),
    [t],
  );

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onSubmit: ({ value }) => {
        const result = schema.safeParse(value);
        if (result.success) return undefined;
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.reduce<string>((acc, segment) => {
            if (typeof segment === "number") return `${acc}[${segment}]`;
            if (typeof segment === "string") {
              return acc ? `${acc}.${segment}` : segment;
            }
            return acc;
          }, "");
          if (path && !fieldErrors[path]) {
            fieldErrors[path] = issue.message;
          }
        }
        return { fields: fieldErrors };
      },
    },
    onSubmitInvalid: () => {
      setTimeout(() => {
        scrollToFormError(submitErrorRef.current);
      }, 0);
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const parsed = schema.parse(value) as AssignmentFormValues;
      const payload = assignmentMutationPayloadFromForm(parsed);
      try {
        if (mode === "create") {
          const assignmentId = await createAssignment.mutateAsync({
            classId,
            ...payload,
          });
          await navigate({
            to: "/class/$classId/assignments/$assignmentId",
            params: { classId, assignmentId },
          });
        } else if (initial) {
          await updateAssignment.mutateAsync({
            classId,
            assignmentId: initial._id,
            ...payload,
          });
          await navigate({
            to: "/class/$classId/assignments/$assignmentId",
            params: { classId, assignmentId: initial._id },
          });
        }
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
        setTimeout(() => {
          scrollToFormError(submitErrorRef.current);
        }, 0);
      }
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        render={<Link to="/class/$classId/assignments" params={{ classId }} />}
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {mode === "create" ? t("createTitle") : t("editTitle")}
        </h1>
        <p className="hidden text-muted-foreground sm:block">
          {mode === "create" ? t("createDescription") : t("editDescription")}
        </p>
      </div>

      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {submitError ? (
          <p ref={submitErrorRef} className="text-sm text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}

        <FieldGroup className="gap-4">
          <form.Field name="name">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="assignment-name">{t("nameLabel")}</FieldLabel>
                  <Input
                    id="assignment-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={MAX_ASSIGNMENT_NAME_LENGTH}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="subject">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="assignment-subject">{t("subjectLabel")}</FieldLabel>
                    <FieldDescription>{t("subjectOptional")}</FieldDescription>
                    <Input
                      id="assignment-subject"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      maxLength={MAX_ASSIGNMENT_SUBJECT_LENGTH}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="unit">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="assignment-unit">{t("unitLabel")}</FieldLabel>
                    <FieldDescription>{t("unitOptional")}</FieldDescription>
                    <Input
                      id="assignment-unit"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      maxLength={MAX_ASSIGNMENT_UNIT_LENGTH}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          <form.Field name="dueDateKey">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="assignment-due">{t("dueDateLabel")}</FieldLabel>
                <Input
                  id="assignment-due"
                  type="datetime-local"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("scoringLabel")}</h2>
          </div>
          <form.Field name="scoringMode">
            {(field) => (
              <Field>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value === "total" || value === "sections") {
                      field.handleChange(value);
                      if (value === "sections" && form.state.values.sections.length === 0) {
                        form.setFieldValue("sections", [createEmptySection()]);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-64" aria-label={t("scoringLabel")}>
                    <SelectValue>
                      {field.state.value === "sections" ? t("scoringSections") : t("scoringTotal")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="total">{t("scoringTotal")}</SelectItem>
                      <SelectItem value="sections">{t("scoringSections")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.scoringMode}>
            {(scoringMode) =>
              scoringMode === "total" ? (
                <form.Field name="totalPoints">
                  {(field) => (
                    <Field>
                      <FieldLabel>{t("totalPointsLabel")}</FieldLabel>
                      <NumberInput
                        value={field.state.value}
                        min={0}
                        onValueChange={(value) => field.handleChange(value)}
                      />
                    </Field>
                  )}
                </form.Field>
              ) : (
                <form.Field name="sections" mode="array">
                  {(field) => {
                    const sectionsError = fieldErrorMessage(field.state.meta.errors);
                    const sectionIds = field.state.value.map((section) => section.key);
                    const canReorderSections = field.state.value.length > 1;

                    const handleSectionsDragEnd = (event: DragEndEvent) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) return;
                      const next = reorderByKey(field.state.value, active.id, over.id);
                      if (next) field.handleChange(next);
                    };

                    const allSectionsCollapsed =
                      sectionIds.length > 0 &&
                      sectionIds.every((key) => collapsedSectionKeys.has(key));

                    return (
                      <div className="flex flex-col gap-4">
                        {sectionsError ? <FieldError>{sectionsError}</FieldError> : null}
                        {field.state.value.length > 0 ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (allSectionsCollapsed) {
                                  setCollapsedSectionKeys(new Set());
                                  return;
                                }
                                setCollapsedSectionKeys(new Set(sectionIds));
                              }}
                            >
                              {allSectionsCollapsed
                                ? t("sectionExpandAll")
                                : t("sectionCollapseAll")}
                            </Button>
                          </div>
                        ) : null}
                        <SortableVerticalList
                          itemIds={sectionIds}
                          onReorder={handleSectionsDragEnd}
                        >
                          {field.state.value.map((section, index) => {
                            const sectionOpen = !collapsedSectionKeys.has(section.key);
                            const sectionTypeLabel =
                              section.type === "rubricLevels"
                                ? t("sectionTypeRubricLevels")
                                : section.type === "rubricCheckboxes"
                                  ? t("sectionTypeRubricCheckboxes")
                                  : t("sectionTypePoints");

                            return (
                              <SortableFormItem
                                key={section.key}
                                id={section.key}
                                rowFocusKey={section.key}
                                disabled={!canReorderSections}
                                dragLabel={t("sectionDrag")}
                                className="rounded-xl border border-border"
                              >
                                {(dragHandle) => (
                                  <Collapsible
                                    open={sectionOpen}
                                    onOpenChange={(nextOpen) => {
                                      setCollapsedSectionKeys((prev) => {
                                        const next = new Set(prev);
                                        if (nextOpen) next.delete(section.key);
                                        else next.add(section.key);
                                        return next;
                                      });
                                    }}
                                  >
                                    <div className="flex items-center gap-2 px-3 py-2.5">
                                      {dragHandle}
                                      <CollapsibleTrigger
                                        type="button"
                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60"
                                        aria-label={
                                          sectionOpen ? t("sectionCollapse") : t("sectionExpand")
                                        }
                                      >
                                        <ChevronRight
                                          className={cn(
                                            "size-4 transition-transform",
                                            sectionOpen && "rotate-90",
                                          )}
                                          aria-hidden
                                        />
                                      </CollapsibleTrigger>
                                      <form.Field name={`sections[${index}].name`}>
                                        {(nameField) => {
                                          const error = fieldErrorMessage(
                                            nameField.state.meta.errors,
                                          );
                                          return (
                                            <Field
                                              className="min-w-0 flex-1"
                                              data-invalid={error ? true : undefined}
                                            >
                                              <Input
                                                value={nameField.state.value}
                                                aria-label={t("sectionNameLabel")}
                                                placeholder={t("sectionNameLabel")}
                                                {...rowFocusTargetProps()}
                                                onChange={(event) =>
                                                  nameField.handleChange(event.target.value)
                                                }
                                              />
                                              {error ? <FieldError>{error}</FieldError> : null}
                                            </Field>
                                          );
                                        }}
                                      </form.Field>
                                      {!sectionOpen ? (
                                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                                          {sectionTypeLabel}
                                        </span>
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0"
                                        aria-label={t("sectionRemove")}
                                        onClick={() => {
                                          field.removeValue(index);
                                          setCollapsedSectionKeys((prev) => {
                                            const next = new Set(prev);
                                            next.delete(section.key);
                                            return next;
                                          });
                                        }}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>

                                    <CollapsibleContent className="border-t border-border px-4 py-3">
                                      <form.Field name={`sections[${index}].type`}>
                                        {(typeField) => (
                                          <div className="flex flex-col gap-3">
                                            <Field>
                                              <FieldLabel>{t("sectionTypeLabel")}</FieldLabel>
                                              <Select
                                                value={typeField.state.value}
                                                onValueChange={(value) => {
                                                  if (
                                                    value !== "points" &&
                                                    value !== "rubricLevels" &&
                                                    value !== "rubricCheckboxes"
                                                  ) {
                                                    return;
                                                  }
                                                  typeField.handleChange(
                                                    value as AssignmentSectionType,
                                                  );
                                                  if (value === "rubricLevels") {
                                                    const levels = form.getFieldValue(
                                                      `sections[${index}].levels`,
                                                    );
                                                    if (!levels || levels.length === 0) {
                                                      form.setFieldValue(
                                                        `sections[${index}].levels`,
                                                        [createEmptyRubricEntry()],
                                                      );
                                                    }
                                                  }
                                                  if (value === "rubricCheckboxes") {
                                                    const items = form.getFieldValue(
                                                      `sections[${index}].items`,
                                                    );
                                                    if (!items || items.length === 0) {
                                                      form.setFieldValue(
                                                        `sections[${index}].items`,
                                                        [createEmptyRubricEntry()],
                                                      );
                                                    }
                                                  }
                                                }}
                                              >
                                                <SelectTrigger aria-label={t("sectionTypeLabel")}>
                                                  <SelectValue>
                                                    {typeField.state.value === "rubricLevels"
                                                      ? t("sectionTypeRubricLevels")
                                                      : typeField.state.value === "rubricCheckboxes"
                                                        ? t("sectionTypeRubricCheckboxes")
                                                        : t("sectionTypePoints")}
                                                  </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectGroup>
                                                    <SelectItem value="points">
                                                      {t("sectionTypePoints")}
                                                    </SelectItem>
                                                    <SelectItem value="rubricLevels">
                                                      {t("sectionTypeRubricLevels")}
                                                    </SelectItem>
                                                    <SelectItem value="rubricCheckboxes">
                                                      {t("sectionTypeRubricCheckboxes")}
                                                    </SelectItem>
                                                  </SelectGroup>
                                                </SelectContent>
                                              </Select>
                                            </Field>

                                            {typeField.state.value === "points" ? (
                                              <form.Field name={`sections[${index}].maxPoints`}>
                                                {(pointsField) => (
                                                  <Field>
                                                    <FieldLabel>
                                                      {t("sectionMaxPointsLabel")}
                                                    </FieldLabel>
                                                    <NumberInput
                                                      value={pointsField.state.value}
                                                      min={0}
                                                      onValueChange={(value) =>
                                                        pointsField.handleChange(value)
                                                      }
                                                    />
                                                  </Field>
                                                )}
                                              </form.Field>
                                            ) : null}

                                            {typeField.state.value === "rubricLevels" ? (
                                              <form.Field
                                                name={`sections[${index}].levels`}
                                                mode="array"
                                              >
                                                {(levelsField) => {
                                                  const levelsError = fieldErrorMessage(
                                                    levelsField.state.meta.errors,
                                                  );
                                                  const levelIds = levelsField.state.value.map(
                                                    (level) => level.key,
                                                  );
                                                  const canReorderLevels =
                                                    levelsField.state.value.length > 1;

                                                  const handleLevelsDragEnd = (
                                                    event: DragEndEvent,
                                                  ) => {
                                                    const { active, over } = event;
                                                    if (!over || active.id === over.id) return;
                                                    const next = reorderByKey(
                                                      levelsField.state.value,
                                                      active.id,
                                                      over.id,
                                                    );
                                                    if (next) levelsField.handleChange(next);
                                                  };

                                                  return (
                                                    <div className="flex flex-col gap-2">
                                                      {levelsError ? (
                                                        <FieldError>{levelsError}</FieldError>
                                                      ) : null}
                                                      <SortableVerticalList
                                                        itemIds={levelIds}
                                                        onReorder={handleLevelsDragEnd}
                                                      >
                                                        {levelsField.state.value.map(
                                                          (level, levelIndex) => (
                                                            <SortableFormItem
                                                              key={level.key}
                                                              id={level.key}
                                                              rowFocusKey={level.key}
                                                              disabled={!canReorderLevels}
                                                              dragLabel={t("levelDrag")}
                                                              className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-start"
                                                            >
                                                              {(levelDragHandle) => (
                                                                <>
                                                                  {levelDragHandle ? (
                                                                    <div className="shrink-0 self-start sm:mt-6">
                                                                      {levelDragHandle}
                                                                    </div>
                                                                  ) : null}
                                                                  <form.Field
                                                                    name={`sections[${index}].levels[${levelIndex}].description`}
                                                                  >
                                                                    {(descField) => {
                                                                      const error =
                                                                        fieldErrorMessage(
                                                                          descField.state.meta
                                                                            .errors,
                                                                        );
                                                                      return (
                                                                        <Field
                                                                          className="min-w-0 flex-1"
                                                                          data-invalid={
                                                                            error ? true : undefined
                                                                          }
                                                                        >
                                                                          <FieldLabel>
                                                                            {t(
                                                                              "levelDescriptionLabel",
                                                                            )}
                                                                          </FieldLabel>
                                                                          <Textarea
                                                                            value={
                                                                              descField.state.value
                                                                            }
                                                                            onBlur={
                                                                              descField.handleBlur
                                                                            }
                                                                            {...rowFocusTargetProps()}
                                                                            onChange={(event) =>
                                                                              descField.handleChange(
                                                                                event.target.value,
                                                                              )
                                                                            }
                                                                            rows={2}
                                                                          />
                                                                          {error ? (
                                                                            <FieldError>
                                                                              {error}
                                                                            </FieldError>
                                                                          ) : null}
                                                                        </Field>
                                                                      );
                                                                    }}
                                                                  </form.Field>
                                                                  <form.Field
                                                                    name={`sections[${index}].levels[${levelIndex}].points`}
                                                                  >
                                                                    {(pointsField) => (
                                                                      <Field className="w-fit shrink-0">
                                                                        <FieldLabel>
                                                                          {t("levelPointsLabel")}
                                                                        </FieldLabel>
                                                                        <NumberInput
                                                                          value={
                                                                            pointsField.state.value
                                                                          }
                                                                          min={0}
                                                                          onValueChange={(value) =>
                                                                            pointsField.handleChange(
                                                                              value,
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>
                                                                    )}
                                                                  </form.Field>
                                                                  <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="shrink-0 self-end sm:self-start sm:mt-6"
                                                                    aria-label={t("levelRemove")}
                                                                    disabled={
                                                                      levelsField.state.value
                                                                        .length <= 1
                                                                    }
                                                                    onClick={() =>
                                                                      levelsField.removeValue(
                                                                        levelIndex,
                                                                      )
                                                                    }
                                                                  >
                                                                    <Trash2 className="size-4" />
                                                                  </Button>
                                                                </>
                                                              )}
                                                            </SortableFormItem>
                                                          ),
                                                        )}
                                                      </SortableVerticalList>
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-fit"
                                                        onClick={() => {
                                                          const entry = createEmptyRubricEntry();
                                                          levelsField.pushValue(entry);
                                                          queueRowFocus(entry.key);
                                                        }}
                                                      >
                                                        <Plus className="size-4" />
                                                        {t("levelAdd")}
                                                      </Button>
                                                    </div>
                                                  );
                                                }}
                                              </form.Field>
                                            ) : null}

                                            {typeField.state.value === "rubricCheckboxes" ? (
                                              <form.Field
                                                name={`sections[${index}].items`}
                                                mode="array"
                                              >
                                                {(itemsField) => {
                                                  const itemsError = fieldErrorMessage(
                                                    itemsField.state.meta.errors,
                                                  );
                                                  const itemIds = itemsField.state.value.map(
                                                    (item) => item.key,
                                                  );
                                                  const canReorderItems =
                                                    itemsField.state.value.length > 1;

                                                  const handleItemsDragEnd = (
                                                    event: DragEndEvent,
                                                  ) => {
                                                    const { active, over } = event;
                                                    if (!over || active.id === over.id) return;
                                                    const next = reorderByKey(
                                                      itemsField.state.value,
                                                      active.id,
                                                      over.id,
                                                    );
                                                    if (next) itemsField.handleChange(next);
                                                  };

                                                  return (
                                                    <div className="flex flex-col gap-2">
                                                      {itemsError ? (
                                                        <FieldError>{itemsError}</FieldError>
                                                      ) : null}
                                                      <SortableVerticalList
                                                        itemIds={itemIds}
                                                        onReorder={handleItemsDragEnd}
                                                      >
                                                        {itemsField.state.value.map(
                                                          (item, itemIndex) => (
                                                            <SortableFormItem
                                                              key={item.key}
                                                              id={item.key}
                                                              rowFocusKey={item.key}
                                                              disabled={!canReorderItems}
                                                              dragLabel={t("checkboxDrag")}
                                                              className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-start"
                                                            >
                                                              {(itemDragHandle) => (
                                                                <>
                                                                  {itemDragHandle ? (
                                                                    <div className="shrink-0 self-start sm:mt-6">
                                                                      {itemDragHandle}
                                                                    </div>
                                                                  ) : null}
                                                                  <form.Field
                                                                    name={`sections[${index}].items[${itemIndex}].description`}
                                                                  >
                                                                    {(descField) => {
                                                                      const error =
                                                                        fieldErrorMessage(
                                                                          descField.state.meta
                                                                            .errors,
                                                                        );
                                                                      return (
                                                                        <Field
                                                                          className="min-w-0 flex-1"
                                                                          data-invalid={
                                                                            error ? true : undefined
                                                                          }
                                                                        >
                                                                          <FieldLabel>
                                                                            {t(
                                                                              "checkboxDescriptionLabel",
                                                                            )}
                                                                          </FieldLabel>
                                                                          <Textarea
                                                                            value={
                                                                              descField.state.value
                                                                            }
                                                                            onBlur={
                                                                              descField.handleBlur
                                                                            }
                                                                            {...rowFocusTargetProps()}
                                                                            onChange={(event) =>
                                                                              descField.handleChange(
                                                                                event.target.value,
                                                                              )
                                                                            }
                                                                            rows={2}
                                                                          />
                                                                          {error ? (
                                                                            <FieldError>
                                                                              {error}
                                                                            </FieldError>
                                                                          ) : null}
                                                                        </Field>
                                                                      );
                                                                    }}
                                                                  </form.Field>
                                                                  <form.Field
                                                                    name={`sections[${index}].items[${itemIndex}].points`}
                                                                  >
                                                                    {(pointsField) => (
                                                                      <Field className="w-fit shrink-0">
                                                                        <FieldLabel>
                                                                          {t("checkboxPointsLabel")}
                                                                        </FieldLabel>
                                                                        <NumberInput
                                                                          value={
                                                                            pointsField.state.value
                                                                          }
                                                                          min={0}
                                                                          onValueChange={(value) =>
                                                                            pointsField.handleChange(
                                                                              value,
                                                                            )
                                                                          }
                                                                        />
                                                                      </Field>
                                                                    )}
                                                                  </form.Field>
                                                                  <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="shrink-0 self-end sm:self-start sm:mt-6"
                                                                    aria-label={t("checkboxRemove")}
                                                                    disabled={
                                                                      itemsField.state.value
                                                                        .length <= 1
                                                                    }
                                                                    onClick={() =>
                                                                      itemsField.removeValue(
                                                                        itemIndex,
                                                                      )
                                                                    }
                                                                  >
                                                                    <Trash2 className="size-4" />
                                                                  </Button>
                                                                </>
                                                              )}
                                                            </SortableFormItem>
                                                          ),
                                                        )}
                                                      </SortableVerticalList>
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-fit"
                                                        onClick={() => {
                                                          const entry = createEmptyRubricEntry();
                                                          itemsField.pushValue(entry);
                                                          queueRowFocus(entry.key);
                                                        }}
                                                      >
                                                        <Plus className="size-4" />
                                                        {t("checkboxAdd")}
                                                      </Button>
                                                    </div>
                                                  );
                                                }}
                                              </form.Field>
                                            ) : null}
                                          </div>
                                        )}
                                      </form.Field>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </SortableFormItem>
                            );
                          })}
                        </SortableVerticalList>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-fit"
                          onClick={() => {
                            const section = createEmptySection();
                            field.pushValue(section);
                            setCollapsedSectionKeys((prev) => {
                              const next = new Set(prev);
                              next.delete(section.key);
                              return next;
                            });
                            queueRowFocus(section.key);
                          }}
                        >
                          <Plus className="size-4" />
                          {t("sectionAdd")}
                        </Button>
                      </div>
                    );
                  }}
                </form.Field>
              )
            }
          </form.Subscribe>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("instructionsLabel")}</h2>
            <p className="text-sm text-muted-foreground">{t("instructionsDescription")}</p>
          </div>
          <form.Field name="instructionsJson">
            {(field) => (
              <AssignmentInstructionsEditor
                value={field.state.value}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("procedureLabel")}</h2>
            <p className="text-sm text-muted-foreground">{t("procedureDescription")}</p>
          </div>
          <form.Field name="procedureSteps" mode="array">
            {(field) => (
              <div className="flex flex-col gap-3">
                {field.state.value.map((step, index) => (
                  <div
                    key={step.key}
                    {...rowFocusKeyProps(step.key)}
                    className="flex flex-col gap-2 rounded-xl border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel>{t("procedureStepLabel", { number: index + 1 })}</FieldLabel>
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
                      {(bodyField) => {
                        const error = fieldErrorMessage(bodyField.state.meta.errors);
                        return (
                          <Field data-invalid={error ? true : undefined}>
                            <Textarea
                              value={bodyField.state.value}
                              placeholder={t("procedureStepPlaceholder")}
                              {...rowFocusTargetProps()}
                              onChange={(event) => bodyField.handleChange(event.target.value)}
                              rows={2}
                            />
                            {error ? <FieldError>{error}</FieldError> : null}
                          </Field>
                        );
                      }}
                    </form.Field>
                    <form.Subscribe
                      selector={(state) => ({
                        addAsTask: state.values.procedureSteps[index]?.addAsTask ?? false,
                        taskId: state.values.procedureSteps[index]?.taskId,
                      })}
                    >
                      {({ addAsTask, taskId }) => {
                        if (taskId && addAsTask) {
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm text-muted-foreground">
                                {t("procedureLinkedTask")}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Keep taskId so save deletes the linked task; UI then
                                  // offers "Add as task" to create a replacement.
                                  form.setFieldValue(`procedureSteps[${index}].addAsTask`, false);
                                }}
                              >
                                <Trash2 className="size-4" />
                                {t("procedureDeleteLinkedTask")}
                              </Button>
                            </div>
                          );
                        }
                        return (
                          <form.Field name={`procedureSteps[${index}].addAsTask`}>
                            {(taskField) => (
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={taskField.state.value}
                                  onCheckedChange={(checked) => {
                                    if (checked === true) {
                                      // Drop any pending-delete taskId so a new task is created.
                                      const step = form.getFieldValue(`procedureSteps[${index}]`);
                                      form.setFieldValue(`procedureSteps[${index}]`, {
                                        key: step.key,
                                        body: step.body,
                                        addAsTask: true,
                                      });
                                      return;
                                    }
                                    taskField.handleChange(false);
                                  }}
                                />
                                {t("procedureAddAsTask")}
                              </label>
                            )}
                          </form.Field>
                        );
                      }}
                    </form.Subscribe>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => {
                    const step = createEmptyProcedureStep();
                    field.pushValue(step);
                    queueRowFocus(step.key);
                  }}
                >
                  <Plus className="size-4" />
                  {t("procedureAddStep")}
                </Button>
              </div>
            )}
          </form.Field>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("acceptLinkSubmissionsLabel")}</h2>
            <p className="text-sm text-muted-foreground">{t("acceptLinkSubmissionsDescription")}</p>
          </div>
          <form.Field name="acceptLinkSubmissions">
            {(field) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                {t("acceptLinkSubmissionsCheckbox")}
              </label>
            )}
          </form.Field>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("expectationsLabel")}</h2>
            <p className="text-sm text-muted-foreground">{t("expectationsDescription")}</p>
          </div>
          <form.Field name="expectationIds" mode="array">
            {(field) => {
              if (!expectations || expectations.length === 0) {
                return <p className="text-sm text-muted-foreground">{t("expectationsEmpty")}</p>;
              }
              return (
                <div className="flex flex-col gap-2">
                  {expectations.map((expectation) => {
                    const checked = field.state.value.includes(expectation._id);
                    return (
                      <label
                        key={expectation._id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            if (next === true) {
                              field.pushValue(expectation._id);
                            } else {
                              const index = field.state.value.indexOf(expectation._id);
                              if (index >= 0) field.removeValue(index);
                            }
                          }}
                        />
                        <span>
                          {expectation.name}{" "}
                          <span className="text-muted-foreground">({expectation.unit})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            }}
          </form.Field>
        </section>

        <div className="flex flex-wrap gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <AsyncButton type="submit" pending={isSubmitting}>
                {t("saveAction")}
              </AsyncButton>
            )}
          </form.Subscribe>
          <Button
            type="button"
            variant="outline"
            render={<Link to="/class/$classId/assignments" params={{ classId }} />}
          >
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
