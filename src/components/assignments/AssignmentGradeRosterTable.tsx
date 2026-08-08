import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AssignmentGradeCheckboxesCell,
  AssignmentGradeExcusedCell,
  AssignmentGradeLevelsCell,
  AssignmentGradePointsCell,
  AssignmentGradeSummaryPercentCell,
  AssignmentGradeSummaryTotalCell,
} from "@/components/assignments/AssignmentGradeCells";
import { AssignmentGradeEditProvider } from "@/components/assignments/AssignmentGradeEditProvider";
import { AssignmentGradeRowActions } from "@/components/assignments/AssignmentGradeRowActions";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { Button } from "@/components/ui/button";
import { useClearAssignmentScore } from "@/hooks/assignments/useClearAssignmentScore";
import { useUpsertAssignmentScore } from "@/hooks/assignments/useUpsertAssignmentScore";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import type { AssignmentDetail } from "@/lib/assignments/assignments";
import {
  buildGradeColumns,
  computeScoreTotals,
  draftFromScore,
  draftToUpsertPayload,
  scoreByStudentId,
  type AssignmentScoreList,
  type GradeColumn,
  type StudentScoreDraft,
} from "@/lib/assignments/assignmentScores";
import {
  normalizeColumnOrder,
  normalizeColumnVisibility,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const GRADE_ROSTER_SURFACE = "assignment-grade";

type AssignmentGradeRosterTableProps = {
  classId: Id<"classes">;
  assignmentId: Id<"assignments">;
  assignment: Pick<AssignmentDetail, "scoringMode" | "totalPoints" | "sections">;
  students: StudentRosterEntry[];
  scores: AssignmentScoreList;
};

function sortValueForColumn(column: GradeColumn, draft: StudentScoreDraft): number | string | null {
  if (column.kind === "total") {
    return draft.totalPointsEarned ?? null;
  }
  const section = draft.sectionScores[column.sectionKey];
  if (column.kind === "points") {
    return section?.pointsEarned ?? null;
  }
  if (column.kind === "rubricLevels") {
    const key = section?.selectedLevelKey;
    if (!key) return null;
    return column.levels.find((level) => level.key === key)?.points ?? null;
  }
  const keys = section?.checkedItemKeys ?? [];
  if (keys.length === 0) return null;
  return keys.reduce((sum, key) => {
    const item = column.items.find((entry) => entry.key === key);
    return sum + (item?.points ?? 0);
  }, 0);
}

export function AssignmentGradeRosterTable({
  classId,
  assignmentId,
  assignment,
  students,
  scores,
}: AssignmentGradeRosterTableProps) {
  const { t } = useTranslation("assignments");
  const { data: settings } = useClassUserSettings(classId);
  const upsertScore = useUpsertAssignmentScore();
  const clearScore = useClearAssignmentScore();

  const columnOrder = useMemo(
    () => normalizeColumnOrder(settings?.studentsColumnOrder),
    [settings?.studentsColumnOrder],
  );
  const baseColumnVisibility = useMemo(
    () => normalizeColumnVisibility(settings?.studentsColumnVisibility),
    [settings?.studentsColumnVisibility],
  );
  const { columnVisibility, setColumnVisibility } = useRosterConsumerColumnVisibility(
    classId,
    GRADE_ROSTER_SURFACE,
    baseColumnVisibility,
  );

  const scoreMap = useMemo(() => scoreByStudentId(scores), [scores]);
  const gradeColumns = useMemo(
    () => buildGradeColumns(assignment, { total: t("gradeTotalColumn") }),
    [assignment, t],
  );

  const [gradeAll, setGradeAll] = useState(false);
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [draftsByStudentId, setDraftsByStudentId] = useState<Record<string, StudentScoreDraft>>({});
  const [baselineByStudentId, setBaselineByStudentId] = useState<Record<string, StudentScoreDraft>>(
    {},
  );

  const isRowEditable = useCallback(
    (studentUserId: Id<"users">) => gradeAll || editingUserId === studentUserId,
    [editingUserId, gradeAll],
  );

  const getDraft = useCallback(
    (studentUserId: Id<"users">) => {
      const existing = draftsByStudentId[studentUserId];
      if (existing) return existing;
      return draftFromScore(scoreMap.get(studentUserId));
    },
    [draftsByStudentId, scoreMap],
  );

  const applyAndCommit = useCallback(
    (studentUserId: Id<"users">, patch: (prev: StudentScoreDraft) => StudentScoreDraft) => {
      setDraftsByStudentId((prev) => {
        const current = prev[studentUserId] ?? draftFromScore(scoreMap.get(studentUserId));
        const next = patch(current);
        void upsertScore.mutateAsync(
          draftToUpsertPayload(next, {
            classId,
            assignmentId,
            studentUserId,
          }),
        );
        return { ...prev, [studentUserId]: next };
      });
    },
    [assignmentId, classId, scoreMap, upsertScore],
  );

  const startRowGrade = useCallback(
    (studentUserId: Id<"users">) => {
      const baseline = draftFromScore(scoreMap.get(studentUserId));
      setGradeAll(false);
      setBaselineByStudentId((prev) => ({ ...prev, [studentUserId]: baseline }));
      setDraftsByStudentId((prev) => ({
        ...prev,
        [studentUserId]: baseline,
      }));
      setEditingUserId(studentUserId);
    },
    [scoreMap],
  );

  const saveRowGrade = useCallback((studentUserId: Id<"users">) => {
    setBaselineByStudentId((prev) => {
      const next = { ...prev };
      delete next[studentUserId];
      return next;
    });
    setEditingUserId(null);
  }, []);

  const cancelRowGrade = useCallback(
    (studentUserId: Id<"users">) => {
      const baseline =
        baselineByStudentId[studentUserId] ?? draftFromScore(scoreMap.get(studentUserId));
      setDraftsByStudentId((prev) => ({ ...prev, [studentUserId]: baseline }));
      void upsertScore.mutateAsync(
        draftToUpsertPayload(baseline, {
          classId,
          assignmentId,
          studentUserId,
        }),
      );
      setBaselineByStudentId((prev) => {
        const next = { ...prev };
        delete next[studentUserId];
        return next;
      });
      setEditingUserId(null);
    },
    [assignmentId, baselineByStudentId, classId, scoreMap, upsertScore],
  );

  const clearStudent = useCallback(
    (studentUserId: Id<"users">) => {
      setDraftsByStudentId((prev) => ({
        ...prev,
        [studentUserId]: { sectionScores: {}, excused: false },
      }));
      void clearScore.mutateAsync({ classId, assignmentId, studentUserId });
    },
    [assignmentId, classId, clearScore],
  );

  const toggleGradeAll = useCallback(() => {
    setGradeAll((prev) => {
      const next = !prev;
      if (next) {
        const drafts: Record<string, StudentScoreDraft> = {};
        for (const student of students) {
          drafts[student.userId] = draftFromScore(scoreMap.get(student.userId));
        }
        setDraftsByStudentId(drafts);
        setEditingUserId(null);
      }
      return next;
    });
  }, [scoreMap, students]);

  const finishGrading = useCallback(
    (studentUserId: Id<"users">) => {
      if (gradeAll) {
        setGradeAll(false);
        return;
      }
      saveRowGrade(studentUserId);
    },
    [gradeAll, saveRowGrade],
  );

  const editContextValue = useMemo(
    () => ({
      gradeAll,
      editingUserId,
      isRowEditable,
      getDraft,
      applyAndCommit,
      startRowGrade,
      saveRowGrade,
      finishGrading,
      cancelRowGrade,
      clearStudent,
    }),
    [
      applyAndCommit,
      cancelRowGrade,
      clearStudent,
      editingUserId,
      finishGrading,
      getDraft,
      gradeAll,
      isRowEditable,
      saveRowGrade,
      startRowGrade,
    ],
  );

  // Keep column defs stable across draft commits so Tab focus is not remounted away.
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    const scoringColumns: ColumnDef<StudentRosterEntry, unknown>[] = gradeColumns.map((column) => ({
      id: column.id,
      accessorFn: (student) => sortValueForColumn(column, getDraftRef.current(student.userId)),
      header: ({ column: tableColumn }) => (
        <DataTableSortableHeader
          label={column.label}
          sorted={tableColumn.getIsSorted()}
          onSort={() => tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const studentUserId = row.original.userId;
        if (column.kind === "total" || column.kind === "points") {
          return <AssignmentGradePointsCell studentUserId={studentUserId} column={column} />;
        }
        if (column.kind === "rubricLevels") {
          return <AssignmentGradeLevelsCell studentUserId={studentUserId} column={column} />;
        }
        return <AssignmentGradeCheckboxesCell studentUserId={studentUserId} column={column} />;
      },
      enableSorting: true,
    }));

    const summaryColumns: ColumnDef<StudentRosterEntry, unknown>[] = [
      {
        id: "summary:total",
        accessorFn: (student) => {
          const totals = computeScoreTotals(assignment, getDraftRef.current(student.userId));
          return totals.hasScore ? totals.earned : null;
        },
        header: ({ column: tableColumn }) => (
          <DataTableSortableHeader
            label={t("gradeSummaryTotalColumn")}
            sorted={tableColumn.getIsSorted()}
            onSort={() => tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <AssignmentGradeSummaryTotalCell
            studentUserId={row.original.userId}
            assignment={assignment}
          />
        ),
        enableSorting: true,
      },
      {
        id: "summary:grade",
        accessorFn: (student) => {
          const totals = computeScoreTotals(assignment, getDraftRef.current(student.userId));
          return totals.percent;
        },
        header: ({ column: tableColumn }) => (
          <DataTableSortableHeader
            label={t("gradePercentColumn")}
            sorted={tableColumn.getIsSorted()}
            onSort={() => tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <AssignmentGradeSummaryPercentCell
            studentUserId={row.original.userId}
            assignment={assignment}
          />
        ),
        enableSorting: true,
      },
      {
        id: "summary:excused",
        accessorFn: (student) => (getDraftRef.current(student.userId).excused ? 1 : 0),
        header: ({ column: tableColumn }) => (
          <DataTableSortableHeader
            label={t("gradeExcusedColumn")}
            sorted={tableColumn.getIsSorted()}
            onSort={() => tableColumn.toggleSorting(tableColumn.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <AssignmentGradeExcusedCell studentUserId={row.original.userId} />,
        enableSorting: true,
      },
    ];

    return [...scoringColumns, ...summaryColumns];
  }, [assignment, gradeColumns, t]);

  const renderRowActions = useCallback(
    ({ student }: { student: StudentRosterEntry }) => (
      <AssignmentGradeRowActions student={student} />
    ),
    [],
  );

  return (
    <AssignmentGradeEditProvider value={editContextValue}>
      <div className="flex min-w-0 flex-col gap-3" data-grade-table="">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant={gradeAll ? "default" : "outline"}
            size="sm"
            onClick={toggleGradeAll}
          >
            {gradeAll ? t("gradeAllStopAction") : t("gradeAllAction")}
          </Button>
          <RosterColumnVisibilityMenu
            columnOrder={columnOrder}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
        </div>
        <RosterTable
          data={students}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          extraColumns={extraColumns}
          renderRowActions={renderRowActions}
        />
      </div>
    </AssignmentGradeEditProvider>
  );
}
