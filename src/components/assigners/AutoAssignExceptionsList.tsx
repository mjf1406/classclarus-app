import type { Id } from "../../../convex/_generated/dataModel";
import type { SeatingRelaxations } from "../../../convex/lib/seating/types";
import { useTranslation } from "react-i18next";

import { ConstraintKindBadge } from "@/components/assigners/SeatConstraintKind";
import { useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useClass } from "@/hooks/classes/useClass";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import { constraintKindLabel, seatConstraintSummary } from "@/lib/assigners/seatConstraints";
import { hasAppliedRelaxations } from "@/lib/assigners/seating/autoAssignRecovery";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";

type AutoAssignExceptionsListProps = {
  classId: Id<"classes">;
  appliedRelaxations: SeatingRelaxations;
};

export function AutoAssignExceptionsList({
  classId,
  appliedRelaxations,
}: AutoAssignExceptionsListProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { data: classDoc } = useClass(classId);
  const { data: constraints } = useSeatConstraints(classId);
  const { data: roster } = useStudentRoster(classId);

  if (!hasAppliedRelaxations(appliedRelaxations)) return null;

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const unnamed = tClasses("unnamedMember");
  const studentName = (userId: Id<"users">) => {
    const student = roster?.find((entry) => entry.userId === userId);
    return student
      ? getRosterDisplayName(student, unnamed, nameFormat)
      : t("constraintUnknownStudent");
  };

  const omittedIds = new Set(appliedRelaxations.omittedConstraintIds ?? []);
  const omittedConstraints = (constraints ?? []).filter((constraint) =>
    omittedIds.has(constraint._id),
  );

  return (
    <ul className="mt-2 flex flex-col gap-3">
      {appliedRelaxations.omitGenderParity ? (
        <li className="text-sm">{t("autoAssignExceptionGenderParity")}</li>
      ) : null}
      {(appliedRelaxations.omittedLockedStudentIds ?? []).map((studentUserId) => (
        <li key={studentUserId} className="text-sm">
          {t("autoAssignExceptionLockedSeat", { student: studentName(studentUserId) })}
        </li>
      ))}
      {omittedConstraints.map((constraint) => (
        <li key={constraint._id} className="flex flex-col gap-0.5">
          <ConstraintKindBadge
            polarity={constraint.polarity}
            type={constraint.type}
            label={constraintKindLabel(constraint.polarity, constraint.type, t)}
          />
          <span className="pl-7 text-sm">{seatConstraintSummary(constraint, studentName, t)}</span>
        </li>
      ))}
    </ul>
  );
}
