import { useTranslation } from "react-i18next";

import { RandomAssignerItemCountCell } from "@/components/assigners/random/RandomAssignerItemCountCell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RandomAssignerDataRow } from "@/lib/assigners/randomAssignerData";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../../convex/_generated/dataModel";

type RandomAssignerDataStudentCardProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  student: StudentRosterEntry;
  rows: RandomAssignerDataRow[];
  nameFormat?: RosterNameFormat;
};

export function RandomAssignerDataStudentCard({
  classId,
  assignerId,
  student,
  rows,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
}: RandomAssignerDataStudentCardProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);

  return (
    <Card size="sm" className="h-full">
      <CardHeader className="flex flex-row items-center gap-2 border-b pb-(--card-spacing)">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
          {student.rosterNumber}
        </span>
        <CardTitle className="truncate text-base font-semibold">{displayName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("randomDataHistoryEmpty")}</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[65%]">{t("randomPrintItemColumn")}</TableHead>
                <TableHead className="w-[35%] text-right">{t("seatsDataQuantityColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.item}>
                  <TableCell colSpan={2} className="p-0 whitespace-normal">
                    <RandomAssignerItemCountCell
                      classId={classId}
                      assignerId={assignerId}
                      studentUserId={student.userId}
                      item={row.item}
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
