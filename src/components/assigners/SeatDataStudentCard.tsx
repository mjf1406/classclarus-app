import { ChevronRightIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { SeatDataItemCountCell } from "@/components/assigners/SeatDataItemCountCell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SeatLayoutMatrixDimension } from "@/hooks/assigners/useSeatLayoutRosterMatrix";
import {
  seatConstraintPlainLanguageParts,
  type SeatConstraint,
} from "@/lib/assigners/seatConstraints";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { SeatHistoryRow } from "@/lib/assigners/seating/seatHistoryRows";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatDataStudentCardProps = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
  dimension: SeatLayoutMatrixDimension;
  student: StudentRosterEntry;
  rows: SeatHistoryRow[];
  constraints: SeatConstraint[];
  studentNameById: Map<Id<"users">, string>;
  nameFormat?: RosterNameFormat;
};

export function SeatDataStudentCard({
  classId,
  layoutId,
  dimension,
  student,
  rows,
  constraints,
  studentNameById,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
}: SeatDataStudentCardProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);

  const studentName = useCallback(
    (userId: Id<"users">) => studentNameById.get(userId) ?? t("constraintUnknownStudent"),
    [studentNameById, t],
  );

  return (
    <Card size="sm" className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 border-b pb-(--card-spacing)">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
          {student.rosterNumber}
        </span>
        <CardTitle className="truncate text-base font-semibold">{displayName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        {constraints.length > 0 ? (
          <Collapsible
            open={constraintsOpen}
            onOpenChange={setConstraintsOpen}
            className="mb-3 border-b pb-3"
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm font-medium hover:bg-muted/60">
              <ChevronRightIcon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  constraintsOpen && "rotate-90",
                )}
                aria-hidden
              />
              <span>{t("seatsDataConstraintsTitle", { count: constraints.length })}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1 pl-5">
              <ol className="list-decimal space-y-1.5 pl-4">
                {constraints.map((constraint) => {
                  const { key, values } = seatConstraintPlainLanguageParts(
                    constraint,
                    studentName,
                    t,
                  );
                  return (
                    <li key={constraint._id} className="text-sm text-muted-foreground">
                      <Trans
                        ns="assigners"
                        i18nKey={key}
                        values={values}
                        components={{ bold: <strong className="font-medium text-foreground" /> }}
                      />
                    </li>
                  );
                })}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("seatsDataCardEmpty")}</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[65%]">{t("seatsDataItemColumn")}</TableHead>
                <TableHead className="w-[35%] text-right">{t("seatsDataQuantityColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell colSpan={2} className="p-0 whitespace-normal">
                    <SeatDataItemCountCell
                      classId={classId}
                      layoutId={layoutId}
                      dimension={dimension}
                      studentUserId={student.userId}
                      itemKey={row.key}
                      label={row.label}
                      detail={row.detail}
                      count={row.count}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
