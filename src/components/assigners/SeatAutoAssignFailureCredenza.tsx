import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { ConstraintKindBadge } from "@/components/assigners/SeatConstraintKind";
import { SeatAutoAssignFailureReport } from "@/components/assigners/SeatAutoAssignFailureReport";
import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ProgressButton } from "@/components/ui/progress-button";
import { Spinner } from "@/components/ui/spinner";
import { useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import type { AutoAssignFailureState } from "@/lib/assigners/seating/autoAssignRecovery";
import { buildFailureStudentNameResolver } from "@/lib/assigners/seating/failureStudentContext";
import {
  constraintKindLabel,
  seatConstraintSummary,
  type SeatConstraint,
} from "@/lib/assigners/seatConstraints";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import type { SeatingRelaxableRule } from "../../../convex/lib/seating/types";
import type { SeatingStructuralCause } from "../../../convex/lib/seating/types";
import type { Id } from "../../../convex/_generated/dataModel";

function failureDescriptionKey(failure: AutoAssignFailureState | null): string {
  if (failure?.code === "SEATING_OUTPUT_VIOLATION") return "autoAssignOutputViolation";
  const diagnosis = failure?.diagnosis;
  if (!diagnosis) return "autoAssignFailureGeneric";
  if (diagnosis.status === "unknown") {
    return failure.code === "SEATING_SEARCH_EXHAUSTED"
      ? "autoAssignFailureUnknownSearch"
      : "autoAssignFailureUnknown";
  }
  if (diagnosis.status === "structural") {
    const keys: Record<SeatingStructuralCause, string> = {
      unavailableSeat: "autoAssignStructural_unavailableSeat",
      duplicateManual: "autoAssignStructural_duplicateManual",
      capacityExceeded: "autoAssignStructural_capacityExceeded",
      unavailableStudent: "autoAssignStructural_unavailableStudent",
      noValidSeat: "autoAssignStructural_noValidSeat",
      manualConstraintConflict: "autoAssignStructural_manualConstraintConflict",
      parityLockedConflict: "autoAssignStructural_parityLockedConflict",
      constraintParityConflict: "autoAssignStructural_constraintParityConflict",
      parityCapacityExceeded: "autoAssignStructural_parityCapacityExceeded",
    };
    return keys[diagnosis.cause];
  }
  if (diagnosis.status === "minimalConflict") return "autoAssignFailureMinimalConflict";
  return "autoAssignFailureGeneric";
}

function ruleIdentity(rule: SeatingRelaxableRule): string {
  if (rule.kind === "constraint") return `constraint:${rule.constraintId}`;
  if (rule.kind === "genderParity") return "genderParity";
  return `lockedSeat:${rule.studentUserId}`;
}

function isRuleSelected(
  rules: ReadonlyArray<SeatingRelaxableRule>,
  rule: SeatingRelaxableRule,
): boolean {
  const key = ruleIdentity(rule);
  return rules.some((item) => ruleIdentity(item) === key);
}

function toggleRule(
  rules: ReadonlyArray<SeatingRelaxableRule>,
  rule: SeatingRelaxableRule,
  checked: boolean,
): SeatingRelaxableRule[] {
  const key = ruleIdentity(rule);
  if (checked) {
    if (isRuleSelected(rules, rule)) return [...rules];
    return [...rules, rule];
  }
  return rules.filter((item) => ruleIdentity(item) !== key);
}

type SeatAutoAssignFailureCredenzaProps = {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failure: AutoAssignFailureState | null;
  selectedRules: Array<SeatingRelaxableRule>;
  onSelectedRulesChange: (rules: Array<SeatingRelaxableRule>) => void;
  isRunning: boolean;
  onRetryUnchanged: () => Promise<void>;
  onGenerateWithExceptions: () => Promise<void>;
  onDismiss: () => void;
  layoutId: Id<"seatLayouts">;
};

export function SeatAutoAssignFailureCredenza({
  classId,
  open,
  onOpenChange,
  failure,
  selectedRules,
  onSelectedRulesChange,
  isRunning,
  onRetryUnchanged,
  onGenerateWithExceptions,
  onDismiss,
  layoutId,
}: SeatAutoAssignFailureCredenzaProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { data: classDoc } = useClass(classId);
  const { data: constraints } = useSeatConstraints(classId);
  const { data: board } = useGroupsBoard(classId);
  const { data: roster } = useStudentRoster(classId);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");

  const studentName = useMemo(
    () =>
      buildFailureStudentNameResolver({
        board,
        roster,
        nameFormat,
        unnamed,
        removedLabel: t("constraintRemovedStudent"),
      }),
    [board, nameFormat, roster, t, unnamed],
  );

  const constraintById = useMemo(() => {
    const map = new Map<Id<"seatConstraints">, SeatConstraint>();
    for (const constraint of constraints ?? []) {
      map.set(constraint._id, constraint);
    }
    return map;
  }, [constraints]);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setBusy(false);
    }
  }, [open]);

  const diagnosis = failure?.diagnosis;
  const minimalRules = diagnosis?.status === "minimalConflict" ? diagnosis.rules : [];

  const canGenerateWithExceptions =
    diagnosis?.status === "minimalConflict" && selectedRules.length > 0;

  const descriptionKey = failureDescriptionKey(failure);

  const ruleLabel = (rule: SeatingRelaxableRule): string => {
    if (rule.kind === "genderParity") {
      return t("autoAssignExceptionGenderParity");
    }
    if (rule.kind === "lockedSeat") {
      return t("autoAssignExceptionLockedSeat", { student: studentName(rule.studentUserId) });
    }
    const constraint = constraintById.get(rule.constraintId);
    if (!constraint) return t("autoAssignExceptionMissingConstraint");
    return seatConstraintSummary(constraint, studentName, t);
  };

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!busy && !isRunning) {
          if (!next) onDismiss();
          else onOpenChange(next);
        }
      }}
    >
      <CredenzaContent className="sm:max-w-2xl">
        <CredenzaHeader>
          <CredenzaTitle>{t("autoAssignFailureTitle")}</CredenzaTitle>
          <CredenzaDescription>{t(descriptionKey)}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-4">
          {failure ? (
            <SeatAutoAssignFailureReport
              classId={classId}
              layoutId={layoutId}
              failure={failure}
              studentName={studentName}
              constraintById={constraintById}
              onDismiss={onDismiss}
            />
          ) : null}

          {diagnosis?.status === "minimalConflict" ? (
            <Alert>
              <AlertTitle>{t("autoAssignFailureConflictSetTitle")}</AlertTitle>
              <AlertDescription>{t("autoAssignFailureConflictSetHint")}</AlertDescription>
            </Alert>
          ) : null}

          {minimalRules.length > 0 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>{t("autoAssignFailureRelaxLabel")}</FieldLabel>
                <ul className="flex flex-col gap-3">
                  {minimalRules.map((rule) => {
                    const checked = isRuleSelected(selectedRules, rule);
                    const constraint =
                      rule.kind === "constraint"
                        ? constraintById.get(rule.constraintId)
                        : undefined;
                    return (
                      <li key={ruleIdentity(rule)} className="flex items-start gap-3">
                        <Checkbox
                          id={ruleIdentity(rule)}
                          checked={checked}
                          disabled={busy || isRunning}
                          onCheckedChange={(next) => {
                            onSelectedRulesChange(toggleRule(selectedRules, rule, next === true));
                          }}
                        />
                        <label
                          htmlFor={ruleIdentity(rule)}
                          className="flex flex-col gap-0.5 text-sm leading-snug"
                        >
                          {constraint ? (
                            <ConstraintKindBadge
                              polarity={constraint.polarity}
                              type={constraint.type}
                              label={constraintKindLabel(constraint.polarity, constraint.type, t)}
                            />
                          ) : null}
                          <span className={constraint ? "pl-7" : undefined}>{ruleLabel(rule)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Field>
            </FieldGroup>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter className="flex flex-col gap-2 sm:flex-col">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy || isRunning}
              onClick={onDismiss}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || isRunning}
              onClick={() => void onRetryUnchanged()}
            >
              {isRunning ? <Spinner data-icon="inline-start" /> : null}
              {t("autoAssignFailureRetry")}
            </Button>
            {canGenerateWithExceptions ? (
              <ProgressButton
                key={open ? "open" : "closed"}
                type="button"
                progress={progress}
                disabled={isRunning}
                onClick={async () => {
                  setBusy(true);
                  setProgress(25);
                  try {
                    await onGenerateWithExceptions();
                    setProgress(100);
                  } catch {
                    setBusy(false);
                    setProgress(0);
                  }
                }}
                onSuccess={() => {
                  setBusy(false);
                  setProgress(0);
                }}
              >
                {t("autoAssignFailureGenerateExceptions")}
              </ProgressButton>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              render={
                <Link
                  to="/class/$classId/assigners/seats/constraints"
                  params={{ classId }}
                  onClick={onDismiss}
                />
              }
            >
              {t("autoAssignFailureEditConstraints")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              render={
                <Link
                  to="/class/$classId/assigners/seats/layouts/$layoutId"
                  params={{ classId, layoutId }}
                  onClick={onDismiss}
                />
              }
            >
              {t("autoAssignFailureEditLayout")}
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
