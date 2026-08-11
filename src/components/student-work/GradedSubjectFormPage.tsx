import { Link, useNavigate } from "@tanstack/react-router";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useForm } from "@tanstack/react-form";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId, resolveIconId } from "@/components/icons/fontawesome-icon-catalog";
import { GradedSubjectWeightPie } from "@/components/student-work/GradedSubjectWeightPie";
import { WeightSliceIcon } from "@/components/student-work/WeightSliceIcon";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useCreateGradedSubject } from "@/hooks/gradedSubjects/useCreateGradedSubject";
import { useUpdateGradedSubject } from "@/hooks/gradedSubjects/useUpdateGradedSubject";
import { useGradeScales } from "@/hooks/gradeScales/useGradeScales";
import { resolveGradeScaleDisplayName } from "@/lib/gradeScales/gradeScales";
import {
  createClientGradedSubjectFormSchema,
  describeGradedSubjectItem,
  emptyGradedSubjectFormValues,
  equalSplitWeightPercents,
  formatWeightPercent,
  gradedSubjectFormValuesFromDetail,
  gradedSubjectItemKey,
  gradedSubjectItemMaxPoints,
  pointsSplitWeightPercents,
  sectionPointsLabel,
  type GradedSubjectAssignmentRef,
  type GradedSubjectDetail,
  type GradedSubjectFormItem,
  type GradedSubjectFormValues,
  weightPercentDisplayDecimals,
  weightPercentTotal,
  weightsAreValid,
} from "@/lib/gradedSubjects/gradedSubjects";
import { assignWeightSliceVisuals } from "@/lib/gradedSubjects/weightSliceVisuals";
import type { Id } from "../../../convex/_generated/dataModel";

type GradedSubjectFormPageProps = {
  classId: Id<"classes">;
  mode: "create" | "edit";
  initial?: GradedSubjectDetail | null;
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

function selectableRowsForAssignment(assignment: GradedSubjectAssignmentRef) {
  if (assignment.scoringMode === "total") {
    return [{ assignmentId: assignment._id, sectionKey: undefined as string | undefined }];
  }
  return (assignment.sections ?? []).map((section) => ({
    assignmentId: assignment._id,
    sectionKey: section.key,
  }));
}

function rowHasGradablePoints(
  assignment: GradedSubjectAssignmentRef,
  sectionKey?: string,
): boolean {
  return gradedSubjectItemMaxPoints(assignment, sectionKey) > 0;
}

function resolveItemMaxPoints(
  item: Pick<GradedSubjectFormItem, "assignmentId" | "sectionKey">,
  assignments: GradedSubjectAssignmentRef[],
): number {
  const assignment = assignments.find((row) => row._id === item.assignmentId);
  if (!assignment) return 0;
  return gradedSubjectItemMaxPoints(assignment, item.sectionKey);
}

export function GradedSubjectFormPage({ classId, mode, initial }: GradedSubjectFormPageProps) {
  const { t } = useTranslation("studentWork");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const createSubject = useCreateGradedSubject();
  const updateSubject = useUpdateGradedSubject();
  const { data: assignments } = useAssignments(classId);
  const { data: gradeScales } = useGradeScales(classId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faIcon, setFaIcon] = useState<IconDefinition | null>(null);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(() => new Set());
  const submitErrorRef = useRef<HTMLParagraphElement>(null);

  const visibleScales = useMemo(
    () => (gradeScales ?? []).filter((scale) => !scale.isHidden),
    [gradeScales],
  );

  const defaults = useMemo(
    () => (initial ? gradedSubjectFormValuesFromDetail(initial) : emptyGradedSubjectFormValues()),
    [initial],
  );

  useEffect(() => {
    const icon = defaults.icon;
    if (!icon) {
      setFaIcon(null);
      return;
    }
    let cancelled = false;
    void resolveIconId(icon).then((resolved) => {
      if (!cancelled) setFaIcon(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [defaults.icon]);

  const schema = useMemo(() => createClientGradedSubjectFormSchema(t), [t]);

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
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const values = value as GradedSubjectFormValues;

      try {
        if (mode === "edit" && initial) {
          await updateSubject.mutateAsync({
            classId,
            gradedSubjectId: initial._id,
            values,
          });
        } else {
          await createSubject.mutateAsync({
            classId,
            values,
          });
        }
        await navigate({
          to: "/class/$classId/sw/graded-subjects",
          params: { classId },
        });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : t("subjectSaveFailed"));
      }
    },
  });

  const assignmentRows = useMemo(() => assignments ?? [], [assignments]);

  const toggleExpanded = (assignmentId: string) => {
    setExpandedAssignments((current) => {
      const next = new Set(current);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link to="/class/$classId/sw/graded-subjects" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">{t("backToSubjects")}</span>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {mode === "edit" ? t("editSubjectTitle") : t("createSubjectTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subjectFormDescription")}</p>
        </div>
      </div>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="graded-subject-name">{t("subjectNameLabel")}</FieldLabel>
                  <Input
                    id="graded-subject-name"
                    value={field.state.value}
                    placeholder={t("subjectNamePlaceholder")}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="icon">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              return (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel>
                    {t("subjectIconLabel")}
                    <span className="font-normal text-muted-foreground">
                      ({tCommon("optional")})
                    </span>
                  </FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <FontAwesomeIconPickerLazy
                      value={faIcon}
                      onChange={(icon) => {
                        setFaIcon(icon);
                        field.handleChange(iconDefinitionToId(icon));
                      }}
                      placeholder={t("subjectIconPickerPlaceholder")}
                      className="w-full max-w-[280px]"
                    />
                    {field.state.value ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFaIcon(null);
                          field.handleChange("");
                        }}
                      >
                        {t("subjectClearIcon")}
                      </Button>
                    ) : null}
                  </div>
                  <FieldDescription>{t("subjectIconHelp")}</FieldDescription>
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="gradeScaleId">
            {(field) => {
              const error = fieldErrorMessage(field.state.meta.errors);
              const selectedScale = visibleScales.find((scale) => scale._id === field.state.value);
              const selectedScaleLabel = selectedScale
                ? resolveGradeScaleDisplayName(selectedScale, t, t("unnamedScale"))
                : null;
              return (
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="graded-subject-scale">{t("gradeScaleLabel")}</FieldLabel>
                  <Select
                    value={field.state.value || undefined}
                    onValueChange={(value) => field.handleChange(value as Id<"gradeScales">)}
                  >
                    <SelectTrigger
                      id="graded-subject-scale"
                      className="w-full max-w-md"
                      aria-invalid={error ? true : undefined}
                    >
                      <SelectValue placeholder={t("gradeScalePlaceholder")}>
                        {selectedScaleLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {visibleScales.map((scale) => (
                          <SelectItem key={scale._id} value={scale._id}>
                            {resolveGradeScaleDisplayName(scale, t, t("unnamedScale"))}
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
        </FieldGroup>

        <form.Subscribe selector={(state) => state.values.items}>
          {(items) => {
            const total = weightPercentTotal(items);
            const valid = weightsAreValid(items);
            const weightDecimals = weightPercentDisplayDecimals(
              items.map((item) => item.weightPercent),
            );
            const pieSlices = items.map((item) => ({
              key: gradedSubjectItemKey(item),
              label: describeGradedSubjectItem(item, assignmentRows),
              value: item.weightPercent,
            }));
            const sliceVisuals = assignWeightSliceVisuals(pieSlices.map((slice) => slice.key));

            return (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{t("assignmentsSectionsLabel")}</h2>
                      <p
                        className={cn(
                          "text-sm tabular-nums",
                          valid ? "text-muted-foreground" : "text-destructive",
                        )}
                      >
                        {t("weightsTotal", {
                          total: formatWeightPercent(total, weightDecimals),
                          count: items.length,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={items.length === 0}
                        onClick={() => {
                          const percents = equalSplitWeightPercents(items.length);
                          form.setFieldValue(
                            "items",
                            items.map((item, index) => ({
                              ...item,
                              weightPercent: percents[index] ?? 0,
                            })),
                          );
                        }}
                      >
                        {t("equalSplitWeights")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          items.length === 0 ||
                          items.some((item) => resolveItemMaxPoints(item, assignmentRows) <= 0)
                        }
                        onClick={() => {
                          const points = items.map((item) =>
                            resolveItemMaxPoints(item, assignmentRows),
                          );
                          const percents = pointsSplitWeightPercents(points);
                          if (percents.length !== items.length) return;
                          form.setFieldValue(
                            "items",
                            items.map((item, index) => ({
                              ...item,
                              weightPercent: percents[index] ?? 0,
                            })),
                          );
                        }}
                      >
                        {t("pointsSplitWeights")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={items.length === 0}
                        onClick={() => form.setFieldValue("items", [])}
                      >
                        {t("clearSelections")}
                      </Button>
                    </div>
                  </div>

                  <form.Field name="items">
                    {(field) => {
                      const itemsError = fieldErrorMessage(field.state.meta.errors);
                      return (
                        <Field data-invalid={itemsError ? true : undefined}>
                          <div className="rounded-xl border">
                            {assignmentRows.length === 0 ? (
                              <p className="p-4 text-sm text-muted-foreground">
                                {t("noAssignmentsAvailable")}
                              </p>
                            ) : (
                              <ul className="divide-y">
                                {assignmentRows.map((assignment) => {
                                  const rows = selectableRowsForAssignment(assignment);
                                  const selectableRows = rows.filter((row) =>
                                    rowHasGradablePoints(assignment, row.sectionKey),
                                  );
                                  const isSectionMode = assignment.scoringMode === "sections";
                                  const selectedKeys = new Set(
                                    field.state.value
                                      .filter((item) => item.assignmentId === assignment._id)
                                      .map((item) => item.sectionKey ?? ""),
                                  );
                                  const allSelected =
                                    selectableRows.length > 0 &&
                                    selectableRows.every((row) =>
                                      selectedKeys.has(row.sectionKey ?? ""),
                                    );
                                  const someSelected =
                                    !allSelected &&
                                    selectableRows.some((row) =>
                                      selectedKeys.has(row.sectionKey ?? ""),
                                    );

                                  const setAssignmentSelection = (checked: boolean) => {
                                    const others = field.state.value.filter(
                                      (item) => item.assignmentId !== assignment._id,
                                    );
                                    if (!checked) {
                                      field.handleChange(others);
                                      return;
                                    }
                                    const nextRows = selectableRows.map((row) => ({
                                      assignmentId: row.assignmentId,
                                      sectionKey: row.sectionKey,
                                      weightPercent: 0,
                                    }));
                                    field.handleChange([...others, ...nextRows]);
                                  };

                                  const toggleRow = (
                                    sectionKey: string | undefined,
                                    checked: boolean,
                                  ) => {
                                    const key = gradedSubjectItemKey({
                                      assignmentId: assignment._id,
                                      sectionKey,
                                    });
                                    if (!checked) {
                                      field.handleChange(
                                        field.state.value.filter(
                                          (item) => gradedSubjectItemKey(item) !== key,
                                        ),
                                      );
                                      return;
                                    }
                                    if (!rowHasGradablePoints(assignment, sectionKey)) {
                                      return;
                                    }
                                    if (
                                      field.state.value.some(
                                        (item) => gradedSubjectItemKey(item) === key,
                                      )
                                    ) {
                                      return;
                                    }
                                    const next = [
                                      ...field.state.value,
                                      {
                                        assignmentId: assignment._id,
                                        sectionKey,
                                        weightPercent: 0,
                                      },
                                    ];
                                    field.handleChange(next);
                                  };

                                  const updateWeight = (itemKey: string, weightPercent: number) => {
                                    field.handleChange(
                                      field.state.value.map((item) =>
                                        gradedSubjectItemKey(item) === itemKey
                                          ? { ...item, weightPercent }
                                          : item,
                                      ),
                                    );
                                  };

                                  if (!isSectionMode) {
                                    const itemKey = gradedSubjectItemKey({
                                      assignmentId: assignment._id,
                                    });
                                    const selectedItem = field.state.value.find(
                                      (item) => gradedSubjectItemKey(item) === itemKey,
                                    );
                                    const canSelect = rowHasGradablePoints(assignment);

                                    return (
                                      <li key={assignment._id} className="p-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                          <label className="flex min-w-0 flex-1 items-center gap-3">
                                            <Checkbox
                                              checked={Boolean(selectedItem)}
                                              disabled={!canSelect && !selectedItem}
                                              onCheckedChange={(checked) =>
                                                toggleRow(undefined, checked === true)
                                              }
                                            />
                                            <span className="min-w-0 truncate font-medium">
                                              {assignment.name}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                              (
                                              {t("pointsMax", {
                                                points: sectionPointsLabel(assignment),
                                              })}
                                              )
                                            </span>
                                          </label>
                                          {selectedItem ? (
                                            <NumberInput
                                              value={selectedItem.weightPercent}
                                              min={0}
                                              max={100}
                                              step={0.01}
                                              suffix="%"
                                              inputClassName="w-36"
                                              onValueChange={(value) =>
                                                updateWeight(itemKey, value)
                                              }
                                            />
                                          ) : null}
                                        </div>
                                      </li>
                                    );
                                  }

                                  const expanded = expandedAssignments.has(assignment._id);

                                  return (
                                    <li key={assignment._id}>
                                      <Collapsible
                                        open={expanded}
                                        onOpenChange={() => toggleExpanded(assignment._id)}
                                      >
                                        <div className="flex items-center gap-2 p-3">
                                          <Checkbox
                                            checked={allSelected}
                                            indeterminate={someSelected && !allSelected}
                                            disabled={selectableRows.length === 0}
                                            onCheckedChange={(checked) =>
                                              setAssignmentSelection(checked === true)
                                            }
                                          />
                                          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                            <ChevronRight
                                              className={cn(
                                                "size-4 shrink-0 transition-transform",
                                                expanded ? "rotate-90" : "",
                                              )}
                                            />
                                            <span className="min-w-0 truncate font-medium">
                                              {assignment.name}
                                            </span>
                                          </CollapsibleTrigger>
                                        </div>
                                        <CollapsibleContent>
                                          <ul className="border-t pb-2 pl-10 pr-3">
                                            {(assignment.sections ?? []).map((section) => {
                                              const itemKey = gradedSubjectItemKey({
                                                assignmentId: assignment._id,
                                                sectionKey: section.key,
                                              });
                                              const selectedItem = field.state.value.find(
                                                (item) => gradedSubjectItemKey(item) === itemKey,
                                              );
                                              const canSelect = rowHasGradablePoints(
                                                assignment,
                                                section.key,
                                              );
                                              return (
                                                <li
                                                  key={section.key}
                                                  className="flex flex-wrap items-center gap-3 py-2"
                                                >
                                                  <label className="flex min-w-0 flex-1 items-center gap-3">
                                                    <Checkbox
                                                      checked={Boolean(selectedItem)}
                                                      disabled={!canSelect && !selectedItem}
                                                      onCheckedChange={(checked) =>
                                                        toggleRow(section.key, checked === true)
                                                      }
                                                    />
                                                    <span className="min-w-0 truncate">
                                                      {section.name}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                      (
                                                      {t("pointsMax", {
                                                        points: sectionPointsLabel(
                                                          assignment,
                                                          section.key,
                                                        ),
                                                      })}
                                                      )
                                                    </span>
                                                  </label>
                                                  {selectedItem ? (
                                                    <NumberInput
                                                      value={selectedItem.weightPercent}
                                                      min={0}
                                                      max={100}
                                                      step={0.01}
                                                      suffix="%"
                                                      inputClassName="w-36"
                                                      onValueChange={(value) =>
                                                        updateWeight(itemKey, value)
                                                      }
                                                    />
                                                  ) : null}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                          <FieldDescription>{t("assignmentsSectionsHelp")}</FieldDescription>
                          {itemsError ? <FieldError>{itemsError}</FieldError> : null}
                        </Field>
                      );
                    }}
                  </form.Field>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border p-4">
                  <h2 className="text-base font-semibold">{t("weightsVisualLabel")}</h2>
                  <GradedSubjectWeightPie
                    slices={pieSlices}
                    totalPercent={total}
                    totalValid={valid}
                  />
                  <ul className="flex flex-col gap-2">
                    <li className="flex items-center justify-between gap-3 border-b pb-2 text-sm font-medium">
                      <span>{t("weightsBreakdownTotal")}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          valid ? "text-foreground" : "text-destructive",
                        )}
                      >
                        {formatWeightPercent(total, weightDecimals)}%
                      </span>
                    </li>
                    {items.map((item) => {
                      const itemKey = gradedSubjectItemKey(item);
                      const visual = sliceVisuals.get(itemKey);
                      return (
                        <li
                          key={itemKey}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {visual ? (
                              <WeightSliceIcon icon={visual.icon} color={visual.color} />
                            ) : null}
                            <span className="min-w-0 truncate">
                              {describeGradedSubjectItem(item, assignmentRows)}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatWeightPercent(item.weightPercent, weightDecimals)}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          }}
        </form.Subscribe>

        {submitError ? (
          <p ref={submitErrorRef} className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={<Link to="/class/$classId/sw/graded-subjects" params={{ classId }} />}
          >
            {t("cancel")}
          </Button>
          <form.Subscribe selector={(state) => [state.values.items, state.isSubmitting]}>
            {([items, isSubmitting]) => (
              <AsyncButton
                type="submit"
                pending={Boolean(isSubmitting)}
                disabled={!weightsAreValid(items as GradedSubjectFormItem[])}
              >
                {mode === "edit" ? t("saveAction") : t("createSubjectConfirm")}
              </AsyncButton>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
