import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAssignmentGradeEdit } from "@/components/assignments/assignmentGradeEditContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignmentDetail } from "@/lib/assignments/assignments";
import {
  computeScoreTotals,
  formatCheckboxDisplay,
  formatLevelDisplay,
  formatScoreDisplay,
  formatScoreFraction,
  formatScorePercent,
  type GradeColumn,
} from "@/lib/assignments/assignmentScores";
import {
  evalScoreExpression,
  isScorePointsInRange,
  normalizeScorePoints,
} from "@/lib/assignments/evalScoreExpression";
import { handleGradeInputKeyDown } from "@/lib/assignments/focusGradeInput";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

const CLEAR_LEVEL_VALUE = "__clear__";

type PointsCellProps = {
  studentUserId: Id<"users">;
  column: Extract<GradeColumn, { kind: "total" | "points" }>;
};

export function AssignmentGradePointsCell({ studentUserId, column }: PointsCellProps) {
  const { t } = useTranslation("assignments");
  const errorId = useId();
  const { isRowEditable, getDraft, applyAndCommit, finishGrading } = useAssignmentGradeEdit();
  const editable = isRowEditable(studentUserId);
  const draft = getDraft(studentUserId);
  const committed =
    column.kind === "total"
      ? draft.totalPointsEarned
      : draft.sectionScores[column.sectionKey]?.pointsEarned;
  const [text, setText] = useState<string | null>(null);
  const [commitError, setCommitError] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setText(null);
    setCommitError(false);
  }, [committed, editable]);

  if (!editable) {
    return <span className="tabular-nums">{formatScoreDisplay(committed, t("scoreUnset"))}</span>;
  }

  const display = text ?? (committed === undefined ? "" : String(committed));
  const liveEvaluated = text === null ? null : evalScoreExpression(text.trim());
  const liveOutOfRange =
    liveEvaluated !== null &&
    !isScorePointsInRange(normalizeScorePoints(liveEvaluated), column.maxPoints);
  const showInvalid = liveOutOfRange || commitError;

  const triggerShake = () => {
    setShaking(false);
    requestAnimationFrame(() => {
      setShaking(true);
    });
  };

  const tryCommit = (raw: string): boolean => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      applyAndCommit(studentUserId, (prev) => {
        if (column.kind === "total") {
          return { sectionScores: prev.sectionScores, excused: prev.excused };
        }
        const nextSections = { ...prev.sectionScores };
        const existing = nextSections[column.sectionKey];
        if (!existing) {
          return prev;
        }
        const rest = {
          ...(existing.selectedLevelKey !== undefined
            ? { selectedLevelKey: existing.selectedLevelKey }
            : {}),
          ...(existing.checkedItemKeys !== undefined
            ? { checkedItemKeys: existing.checkedItemKeys }
            : {}),
        };
        if (
          rest.selectedLevelKey === undefined &&
          (rest.checkedItemKeys === undefined || rest.checkedItemKeys.length === 0)
        ) {
          delete nextSections[column.sectionKey];
        } else {
          nextSections[column.sectionKey] = rest;
        }
        return { ...prev, sectionScores: nextSections };
      });
      setText(null);
      setCommitError(false);
      return true;
    }

    const evaluated = evalScoreExpression(trimmed);
    if (evaluated === null) {
      setText(trimmed);
      setCommitError(true);
      triggerShake();
      return false;
    }
    const next = normalizeScorePoints(evaluated);
    if (!isScorePointsInRange(next, column.maxPoints)) {
      setText(trimmed);
      setCommitError(true);
      triggerShake();
      return false;
    }

    applyAndCommit(studentUserId, (prev) => {
      if (column.kind === "total") {
        return { ...prev, totalPointsEarned: next };
      }
      return {
        ...prev,
        sectionScores: {
          ...prev.sectionScores,
          [column.sectionKey]: {
            ...prev.sectionScores[column.sectionKey],
            pointsEarned: next,
          },
        },
      };
    });
    setText(null);
    setCommitError(false);
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (tryCommit(event.currentTarget.value)) {
        finishGrading(studentUserId);
      }
      return;
    }
    if (event.key === "Tab" || event.key === "Enter") {
      if (!tryCommit(event.currentTarget.value)) {
        event.preventDefault();
        return;
      }
    }
    handleGradeInputKeyDown(event);
  };

  return (
    <div
      className={cn("flex items-center gap-1", shaking && "animate-grade-shake")}
      onAnimationEnd={() => setShaking(false)}
    >
      <Input
        data-grade-input=""
        type="text"
        inputMode="decimal"
        tabIndex={0}
        className="h-8 w-16 tabular-nums"
        aria-label={column.label}
        aria-invalid={showInvalid || undefined}
        aria-describedby={showInvalid ? errorId : undefined}
        value={display}
        onChange={(event) => {
          setText(event.target.value);
          setCommitError(false);
        }}
        onBlur={(event) => {
          void tryCommit(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="text-muted-foreground text-sm tabular-nums">/ {column.maxPoints}</span>
      {showInvalid ? (
        <span id={errorId} className="sr-only">
          {t("scoreOutOfRange", { max: column.maxPoints })}
        </span>
      ) : null}
    </div>
  );
}

type LevelsCellProps = {
  studentUserId: Id<"users">;
  column: Extract<GradeColumn, { kind: "rubricLevels" }>;
};

export function AssignmentGradeLevelsCell({ studentUserId, column }: LevelsCellProps) {
  const { t } = useTranslation("assignments");
  const { isRowEditable, getDraft, applyAndCommit } = useAssignmentGradeEdit();
  const editable = isRowEditable(studentUserId);
  const draft = getDraft(studentUserId);
  const selected = draft.sectionScores[column.sectionKey]?.selectedLevelKey;

  const label = formatLevelDisplay(column.levels, selected, t("scoreUnset"));

  if (!editable) {
    return (
      <span className="block w-56 max-w-56 truncate text-sm" title={label}>
        {label}
      </span>
    );
  }

  return (
    <Select
      value={selected ?? CLEAR_LEVEL_VALUE}
      onValueChange={(value) => {
        const nextKey = value == null || value === CLEAR_LEVEL_VALUE ? undefined : String(value);
        applyAndCommit(studentUserId, (prev) => {
          const nextSections = { ...prev.sectionScores };
          if (!nextKey) {
            delete nextSections[column.sectionKey];
          } else {
            nextSections[column.sectionKey] = { selectedLevelKey: nextKey };
          }
          return { ...prev, sectionScores: nextSections };
        });
      }}
    >
      <SelectTrigger
        data-grade-input=""
        size="sm"
        tabIndex={0}
        className="w-56 max-w-56"
        aria-label={column.label}
        onKeyDown={handleGradeInputKeyDown}
      >
        <SelectValue placeholder={t("scoreUnset")} className="truncate">
          {label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="w-72 max-w-[min(20rem,var(--available-width))]"
        alignItemWithTrigger={false}
      >
        <SelectItem value={CLEAR_LEVEL_VALUE}>{t("scoreUnset")}</SelectItem>
        {column.levels.map((level) => (
          <SelectItem key={level.key} value={level.key} className="items-start py-2.5">
            <span className="block min-w-0 whitespace-normal">
              <span className="text-muted-foreground tabular-nums">({level.points})</span>{" "}
              {level.description}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type CheckboxesCellProps = {
  studentUserId: Id<"users">;
  column: Extract<GradeColumn, { kind: "rubricCheckboxes" }>;
};

export function AssignmentGradeCheckboxesCell({ studentUserId, column }: CheckboxesCellProps) {
  const { t } = useTranslation("assignments");
  const { isRowEditable, getDraft, applyAndCommit } = useAssignmentGradeEdit();
  const editable = isRowEditable(studentUserId);
  const draft = getDraft(studentUserId);
  const checked = draft.sectionScores[column.sectionKey]?.checkedItemKeys ?? [];

  const label = formatCheckboxDisplay(column.items, checked, t("scoreUnset"));

  if (!editable) {
    return (
      <span className="block w-56 max-w-56 truncate text-sm" title={label}>
        {label}
      </span>
    );
  }

  return (
    <div className="flex w-56 max-w-56 flex-col gap-1.5 py-1">
      {column.items.map((item) => {
        const isChecked = checked.includes(item.key);
        return (
          <label key={item.key} className="flex min-w-0 items-start gap-2 text-sm">
            <Checkbox
              data-grade-input=""
              tabIndex={0}
              checked={isChecked}
              aria-label={`${item.description} (${item.points})`}
              onCheckedChange={(value) => {
                const nextChecked = value === true;
                applyAndCommit(studentUserId, (prev) => {
                  const current = prev.sectionScores[column.sectionKey]?.checkedItemKeys ?? [];
                  const nextKeys = nextChecked
                    ? [...new Set([...current, item.key])]
                    : current.filter((key) => key !== item.key);
                  const nextSections = { ...prev.sectionScores };
                  if (nextKeys.length === 0) {
                    delete nextSections[column.sectionKey];
                  } else {
                    nextSections[column.sectionKey] = { checkedItemKeys: nextKeys };
                  }
                  return { ...prev, sectionScores: nextSections };
                });
              }}
              onKeyDown={handleGradeInputKeyDown}
            />
            <span className="min-w-0 whitespace-normal">
              {item.description}{" "}
              <span className="text-muted-foreground tabular-nums">({item.points})</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

type ExcusedCellProps = {
  studentUserId: Id<"users">;
};

export function AssignmentGradeExcusedCell({ studentUserId }: ExcusedCellProps) {
  const { t } = useTranslation("assignments");
  const { isRowEditable, getDraft, applyAndCommit } = useAssignmentGradeEdit();
  const editable = isRowEditable(studentUserId);
  const draft = getDraft(studentUserId);

  return (
    <div className="flex justify-center">
      <Checkbox
        checked={draft.excused}
        disabled={!editable}
        aria-label={t("gradeExcusedColumn")}
        tabIndex={-1}
        onCheckedChange={(value) => {
          if (!editable) return;
          applyAndCommit(studentUserId, (prev) => ({
            ...prev,
            excused: value === true,
          }));
        }}
      />
    </div>
  );
}

type SummaryCellProps = {
  studentUserId: Id<"users">;
  assignment: Pick<AssignmentDetail, "scoringMode" | "totalPoints" | "sections">;
};

export function AssignmentGradeSummaryTotalCell({ studentUserId, assignment }: SummaryCellProps) {
  const { t } = useTranslation("assignments");
  const { getDraft } = useAssignmentGradeEdit();
  const totals = computeScoreTotals(assignment, getDraft(studentUserId));
  return <span className="tabular-nums">{formatScoreFraction(totals, t("scoreUnset"))}</span>;
}

export function AssignmentGradeSummaryPercentCell({ studentUserId, assignment }: SummaryCellProps) {
  const { t } = useTranslation("assignments");
  const { getDraft } = useAssignmentGradeEdit();
  const totals = computeScoreTotals(assignment, getDraft(studentUserId));
  return <span className="tabular-nums">{formatScorePercent(totals, t("scoreUnset"))}</span>;
}
