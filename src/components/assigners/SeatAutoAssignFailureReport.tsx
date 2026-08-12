import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ConstraintKindBadge } from "@/components/assigners/SeatConstraintKind";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AutoAssignFailureState } from "@/lib/assigners/seating/autoAssignRecovery";
import type { StudentFailureContext } from "@/lib/assigners/seating/failureStudentContext";
import {
  constraintKindLabel,
  seatConstraintSummary,
  type SeatConstraint,
} from "@/lib/assigners/seatConstraints";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import type {
  SeatingFailureEvidence,
  SeatingFailureRunContext,
  SeatingStructuralCause,
} from "../../../convex/lib/seating/types";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatAutoAssignFailureReportProps = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  failure: AutoAssignFailureState;
  studentName: (userId: Id<"users">) => string;
  constraintById: Map<Id<"seatConstraints">, SeatConstraint>;
  onDismiss: () => void;
};

function sectionTitleClassName() {
  return "text-sm font-semibold text-foreground";
}

function sectionBodyClassName() {
  return "text-sm text-muted-foreground leading-relaxed";
}

function studentList(
  ids: ReadonlyArray<Id<"users">>,
  studentName: (userId: Id<"users">) => string,
): string {
  return ids.map((id) => studentName(id)).join(", ");
}

function availabilityLabel(
  context: StudentFailureContext | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!context) return t("autoAssignReportStudentUnknown");
  switch (context.availability) {
    case "ungrouped":
      return t("autoAssignReportStudentUngrouped");
    case "notOnBoard":
      return t("autoAssignReportStudentNotOnBoard");
    case "staleRoster":
      return t("autoAssignReportStudentStaleRoster");
    case "inSolverPool":
      return context.groupName
        ? t("autoAssignReportStudentInGroup", { group: context.groupName })
        : t("autoAssignReportStudentGrouped");
    default:
      return t("autoAssignReportStudentUnknown");
  }
}

function structuralSummaryKey(cause: SeatingStructuralCause): string {
  const keys: Record<SeatingStructuralCause, string> = {
    unavailableSeat: "autoAssignReportSummary_unavailableSeat",
    duplicateManual: "autoAssignReportSummary_duplicateManual",
    capacityExceeded: "autoAssignReportSummary_capacityExceeded",
    unavailableStudent: "autoAssignReportSummary_unavailableStudent",
    noValidSeat: "autoAssignReportSummary_noValidSeat",
    manualConstraintConflict: "autoAssignReportSummary_manualConstraintConflict",
    parityLockedConflict: "autoAssignReportSummary_parityLockedConflict",
    constraintParityConflict: "autoAssignReportSummary_constraintParityConflict",
  };
  return keys[cause];
}

function WhatHappenedSection({
  evidence,
  studentName,
  constraintById,
  studentContexts,
  groupNameById,
  t,
}: {
  evidence: SeatingFailureEvidence;
  studentName: (userId: Id<"users">) => string;
  constraintById: Map<Id<"seatConstraints">, SeatConstraint>;
  studentContexts: Map<Id<"users">, StudentFailureContext> | undefined;
  groupNameById: Map<Id<"groups">, string>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  switch (evidence.kind) {
    case "unavailableStudents":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-2">
          {evidence.students.map((student) => (
            <li key={student.studentUserId}>
              <span className="font-medium text-foreground">
                {studentName(student.studentUserId)}
              </span>
              {" — "}
              {availabilityLabel(studentContexts?.get(student.studentUserId), t)}
              {student.referencingConstraints.length > 0 ? (
                <ul className="mt-1 list-disc pl-5">
                  {student.referencingConstraints.map((ref) => {
                    const constraint = constraintById.get(ref.constraintId);
                    return (
                      <li key={`${student.studentUserId}:${ref.constraintId}`}>
                        {constraint ? (
                          <>
                            <ConstraintKindBadge
                              polarity={constraint.polarity}
                              type={constraint.type}
                              label={constraintKindLabel(constraint.polarity, constraint.type, t)}
                            />
                            <span className="pl-7 block">
                              {seatConstraintSummary(constraint, studentName, t)}
                            </span>
                          </>
                        ) : (
                          t("autoAssignExceptionMissingConstraint")
                        )}
                        {ref.roles.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({ref.roles.map((role) => t(`autoAssignReportRole_${role}`)).join(", ")}
                            )
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      );
    case "capacityExceeded":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-2">
          {evidence.groups.map((group) => (
            <li key={group.groupId}>
              {t("autoAssignReportCapacityGroup", {
                group: groupNameById.get(group.groupId) ?? t("autoAssignReportUnknownGroup"),
                required: group.requiredCount,
                available: group.availableSeats,
                students: studentList(group.requiredStudentIds, studentName),
              })}
            </li>
          ))}
        </ul>
      );
    case "noValidSeat":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-2">
          {evidence.students.map((student) => (
            <li key={student.studentUserId}>
              {t("autoAssignReportNoValidSeatStudent", {
                student: studentName(student.studentUserId),
                group: groupNameById.get(student.groupId) ?? t("autoAssignReportUnknownGroup"),
                candidates: student.candidateSeatCount,
                total: student.groupSlotCount,
              })}
            </li>
          ))}
        </ul>
      );
    case "unavailableSeat":
    case "parityLockedConflict":
    case "manualConstraintConflict":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-2">
          {evidence.locks.map((lock) => (
            <li key={`${lock.studentUserId}:${lock.deskItemId}`}>
              {t("autoAssignReportLockedSeat", {
                student: studentName(lock.studentUserId),
                desk: lock.deskNumber ?? lock.deskItemId,
                zone: lock.zoneName ?? t("autoAssignReportNoZone"),
              })}
            </li>
          ))}
          {evidence.kind === "manualConstraintConflict" ? (
            <li>
              {t("autoAssignReportConflictingConstraints", {
                count: evidence.conflictingConstraintIds.length,
              })}
            </li>
          ) : null}
        </ul>
      );
    case "duplicateManual":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-2">
          {evidence.duplicateStudentIds.length > 0 ? (
            <li>
              {t("autoAssignReportDuplicateStudents", {
                students: studentList(evidence.duplicateStudentIds, studentName),
              })}
            </li>
          ) : null}
          {evidence.duplicateDeskKeys.length > 0 ? (
            <li>
              {t("autoAssignReportDuplicateDesks", { count: evidence.duplicateDeskKeys.length })}
            </li>
          ) : null}
        </ul>
      );
    case "constraintParityConflict":
      return (
        <p>
          {t("autoAssignReportConstraintParity", {
            students: studentList(evidence.affectedStudentIds, studentName),
          })}
        </p>
      );
    case "searchExhausted":
      return <p>{t("autoAssignReportSearchExhaustedWhat")}</p>;
    default:
      return null;
  }
}

function WhySection({
  evidence,
  runContext,
  t,
}: {
  evidence: SeatingFailureEvidence;
  runContext: SeatingFailureRunContext;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  switch (evidence.kind) {
    case "noValidSeat":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-1">
          {evidence.students.map((student) => (
            <li key={student.studentUserId}>
              {t("autoAssignReportWhyNoValidSeat", {
                parity: student.parityEliminated,
                zone: student.zoneEliminated,
                occupied: student.occupiedEliminated,
              })}
            </li>
          ))}
        </ul>
      );
    case "capacityExceeded":
      return <p>{t("autoAssignReportWhyCapacity")}</p>;
    case "unavailableStudents":
      return <p>{t("autoAssignReportWhyUnavailableStudents")}</p>;
    case "searchExhausted":
      return (
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>{t("autoAssignReportWhySearchStudents", { count: evidence.movableStudentCount })}</li>
          <li>{t("autoAssignReportWhySearchConstraints", { count: evidence.constraintCount })}</li>
          <li>{t("autoAssignReportWhySearchSlots", { count: evidence.slotCount })}</li>
        </ul>
      );
    case "parityLockedConflict":
      return (
        <p>
          {t("autoAssignReportWhyParityLocked", {
            direction: runContext.malesOnOddDesks
              ? t("autoAssignReportParityMalesOdd")
              : t("autoAssignReportParityMalesEven"),
          })}
        </p>
      );
    case "constraintParityConflict":
      return (
        <p>
          {t("autoAssignReportWhyConstraintParity", {
            direction: evidence.malesOnOddDesks
              ? t("autoAssignReportParityMalesOdd")
              : t("autoAssignReportParityMalesEven"),
          })}
        </p>
      );
    default:
      return <p>{t("autoAssignReportWhyGeneric")}</p>;
  }
}

function FixActions({
  classId,
  layoutId,
  evidence,
  studentContexts,
  onDismiss,
  t,
}: {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  evidence: SeatingFailureEvidence | undefined;
  studentContexts: Map<Id<"users">, StudentFailureContext> | undefined;
  onDismiss: () => void;
  t: (key: string) => string;
}) {
  const actions: Array<{
    key: string;
    label: string;
    to: string;
    search?: Record<string, string>;
  }> = [];

  if (evidence?.kind === "unavailableStudents") {
    for (const student of evidence.students) {
      const ctx = studentContexts?.get(student.studentUserId);
      if (ctx?.availability === "ungrouped" || ctx?.availability === "notOnBoard") {
        actions.push({
          key: `group:${student.studentUserId}`,
          label: t("autoAssignReportFixAssignGroup"),
          to: "/class/$classId/groups",
          search: { focusStudentId: student.studentUserId },
        });
      }
      for (const ref of student.referencingConstraints) {
        actions.push({
          key: `constraint:${ref.constraintId}`,
          label: t("autoAssignReportFixEditConstraint"),
          to: "/class/$classId/assigners/seats/constraints",
          search: { focusConstraintId: ref.constraintId },
        });
      }
    }
  }

  if (evidence?.kind === "capacityExceeded" || evidence?.kind === "noValidSeat") {
    actions.push({
      key: "layout",
      label: t("autoAssignReportFixEditLayout"),
      to: "/class/$classId/assigners/seats/layouts/$layoutId",
    });
  }

  if (
    evidence?.kind === "unavailableSeat" ||
    evidence?.kind === "parityLockedConflict" ||
    evidence?.kind === "manualConstraintConflict"
  ) {
    actions.push({
      key: "chart",
      label: t("autoAssignReportFixEditChart"),
      to: "/class/$classId/assigners/seats/charts",
    });
    actions.push({
      key: "layout-locks",
      label: t("autoAssignReportFixEditLayout"),
      to: "/class/$classId/assigners/seats/layouts/$layoutId",
    });
  }

  if (evidence?.kind === "manualConstraintConflict") {
    for (const constraintId of evidence.conflictingConstraintIds) {
      actions.push({
        key: `constraint:${constraintId}`,
        label: t("autoAssignReportFixEditConstraint"),
        to: "/class/$classId/assigners/seats/constraints",
        search: { focusConstraintId: constraintId },
      });
    }
  }

  const unique = [...new Map(actions.map((action) => [action.key, action])).values()];
  if (unique.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {unique.map((action) => (
        <li key={action.key}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={
              action.to.includes("$layoutId") ? (
                <Link
                  to={action.to as "/class/$classId/assigners/seats/layouts/$layoutId"}
                  params={{ classId, layoutId }}
                  search={action.search}
                  onClick={onDismiss}
                />
              ) : (
                <Link
                  to={
                    action.to as
                      | "/class/$classId/groups"
                      | "/class/$classId/assigners/seats/constraints"
                      | "/class/$classId/assigners/seats/charts"
                  }
                  params={{ classId }}
                  search={action.search}
                  onClick={onDismiss}
                />
              )
            }
          >
            {action.label}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function SeatAutoAssignFailureReport({
  classId,
  layoutId,
  failure,
  studentName,
  constraintById,
  onDismiss,
}: SeatAutoAssignFailureReportProps) {
  const { t } = useTranslation("assigners");
  const { data: board } = useGroupsBoard(classId);
  const diagnosis = failure.diagnosis;

  const groupNameById = useMemo(() => {
    const map = new Map<Id<"groups">, string>();
    for (const group of board?.groups ?? []) {
      map.set(group._id, group.name);
    }
    return map;
  }, [board]);

  if (diagnosis.status === "satisfiable") return null;

  const runContext = diagnosis.runContext;
  const evidence =
    diagnosis.status === "structural"
      ? diagnosis.evidence
      : diagnosis.status === "unknown"
        ? diagnosis.evidence
        : undefined;

  const affectedIds =
    diagnosis.status === "structural" ? diagnosis.affectedStudentIds : evidence ? [] : [];

  const summaryStudents =
    affectedIds.length > 0 ? studentList(affectedIds, studentName) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {diagnosis.status === "structural" ? (
        <Alert>
          <AlertTitle>{t("autoAssignReportSummaryTitle")}</AlertTitle>
          <AlertDescription>
            {t(structuralSummaryKey(diagnosis.cause), {
              students: summaryStudents ?? t("autoAssignReportNoNamedStudents"),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      {diagnosis.status === "unknown" ? (
        <Alert>
          <AlertTitle>{t("autoAssignFailureUnknownTitle")}</AlertTitle>
          <AlertDescription>{t("autoAssignFailureUnknownHint")}</AlertDescription>
        </Alert>
      ) : null}

      {evidence ? (
        <>
          <section className="flex flex-col gap-2">
            <h3 className={sectionTitleClassName()}>{t("autoAssignReportWhatTitle")}</h3>
            <div className={sectionBodyClassName()}>
              <WhatHappenedSection
                evidence={evidence}
                studentName={studentName}
                constraintById={constraintById}
                studentContexts={failure.studentContexts}
                groupNameById={groupNameById}
                t={t}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={sectionTitleClassName()}>{t("autoAssignReportWhyTitle")}</h3>
            <div className={sectionBodyClassName()}>
              <WhySection evidence={evidence} runContext={runContext} t={t} />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={sectionTitleClassName()}>{t("autoAssignReportSettingsTitle")}</h3>
            <ul className={`${sectionBodyClassName()} list-disc pl-5 flex flex-col gap-1`}>
              <li>
                {t("autoAssignReportSettingsParity", {
                  mode:
                    runContext.genderParityMode === "oddEven"
                      ? t("autoAssignReportParityOn", {
                          direction: runContext.malesOnOddDesks
                            ? t("autoAssignReportParityMalesOdd")
                            : t("autoAssignReportParityMalesEven"),
                        })
                      : t("autoAssignReportParityOff"),
                })}
              </li>
              <li>
                {t("autoAssignReportSettingsCounts", {
                  students: runContext.counts.solverStudentCount,
                  seats: runContext.counts.slotCount,
                  constraints: runContext.counts.constraintCount,
                  locked: runContext.counts.lockedCount,
                })}
              </li>
              {runContext.lockedAssignments.length > 0 ? (
                <li>
                  {t("autoAssignReportSettingsLocked", {
                    count: runContext.lockedAssignments.length,
                  })}
                </li>
              ) : null}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={sectionTitleClassName()}>{t("autoAssignReportFixTitle")}</h3>
            <FixActions
              classId={classId}
              layoutId={layoutId}
              evidence={evidence}
              studentContexts={failure.studentContexts}
              onDismiss={onDismiss}
              t={t}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
