import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ExpectationBulkSetCredenza } from "@/components/expectations/ExpectationBulkSetCredenza";
import {
  ExpectationInlineValueCell,
  type ExpectationValueDraftFields,
} from "@/components/expectations/ExpectationInlineValueCell";
import { ExpectationRowActions } from "@/components/expectations/ExpectationRowActions";
import { ExpectationRowEditProvider } from "@/components/expectations/ExpectationRowEditProvider";
import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { RosterColumnVisibilityMenu } from "@/components/roster/RosterColumnVisibilityMenu";
import { RosterTable } from "@/components/roster/RosterTable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast-manager";
import { useBulkApplyExpectationValues } from "@/hooks/expectations/useBulkApplyExpectationValues";
import { useUpsertExpectationStudentValues } from "@/hooks/expectations/useUpsertExpectationStudentValues";
import { useUpsertExpectationValue } from "@/hooks/expectations/useUpsertExpectationValue";
import { useClassUserSettings } from "@/hooks/roster/useClassUserSettings";
import { useRosterConsumerColumnVisibility } from "@/hooks/roster/useRosterConsumerColumnVisibility";
import {
  expectationSortValue,
  valuesByExpectationAndStudent,
  type ExpectationListItem,
  type ExpectationValueDraft,
  type ExpectationValueList,
} from "@/lib/expectations/expectations";
import {
  normalizeColumnOrder,
  normalizeColumnVisibility,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const EXPECTATIONS_ROSTER_SURFACE = "expectations";
const EXPECTATION_DETAIL_ROSTER_SURFACE = "expectation-detail";

type ExpectationsRosterTableProps = {
  classId: Id<"classes">;
  students: StudentRosterEntry[];
  /** Full class size for bulk-apply copy (server updates every student). */
  classStudentCount: number;
  expectations: ExpectationListItem[];
  values: ExpectationValueList;
  /** When set, only this expectation column is shown (detail page). */
  singleExpectationMode?: boolean;
};

function draftFromValue(
  expectation: ExpectationListItem,
  valuesByKey: Map<string, ExpectationValueList[number]>,
  studentUserId: Id<"users">,
): ExpectationValueDraftFields {
  const value = valuesByKey.get(`${expectation._id}:${studentUserId}`);
  return {
    numberValue: value?.numberValue ?? 0,
    rangeMin: value?.rangeMin ?? 0,
    rangeMax: value?.rangeMax ?? 0,
  };
}

export function ExpectationsRosterTable({
  classId,
  students,
  classStudentCount,
  expectations,
  values,
  singleExpectationMode = false,
}: ExpectationsRosterTableProps) {
  const { t } = useTranslation("expectations");
  const { data: settings } = useClassUserSettings(classId);
  const surface = singleExpectationMode
    ? EXPECTATION_DETAIL_ROSTER_SURFACE
    : EXPECTATIONS_ROSTER_SURFACE;

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
    surface,
    baseColumnVisibility,
  );

  const valueMap = useMemo(() => valuesByExpectationAndStudent(values), [values]);
  const upsertValue = useUpsertExpectationValue();
  const upsertStudentValues = useUpsertExpectationStudentValues();
  const bulkApply = useBulkApplyExpectationValues();

  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [draftByExpectationId, setDraftByExpectationId] = useState<
    Record<string, ExpectationValueDraftFields>
  >({});
  const [bulkExpectation, setBulkExpectation] = useState<ExpectationListItem | null>(null);

  const setDraft = useCallback(
    (expectationId: Id<"expectations">, next: ExpectationValueDraftFields) => {
      setDraftByExpectationId((prev) => ({
        ...prev,
        [expectationId]: next,
      }));
    },
    [],
  );

  const startEdit = useCallback(
    (studentUserId: Id<"users">) => {
      const next: Record<string, ExpectationValueDraftFields> = {};
      for (const expectation of expectations) {
        next[expectation._id] = draftFromValue(expectation, valueMap, studentUserId);
      }
      setDraftByExpectationId(next);
      setEditingUserId(studentUserId);
    },
    [expectations, valueMap],
  );

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setDraftByExpectationId({});
  }, []);

  const saveEdit = useCallback(
    (studentUserId: Id<"users">) => {
      const drafts: ExpectationValueDraft[] = [];
      for (const expectation of expectations) {
        const draft = draftByExpectationId[expectation._id];
        if (!draft) continue;
        if (expectation.inputType === "number") {
          drafts.push({
            expectationId: expectation._id,
            numberValue: draft.numberValue,
          });
          continue;
        }
        if (draft.rangeMin > draft.rangeMax) {
          toast.add({
            title: t("rangeOrderInvalid"),
            type: "error",
          });
          return;
        }
        drafts.push({
          expectationId: expectation._id,
          rangeMin: draft.rangeMin,
          rangeMax: draft.rangeMax,
        });
      }

      // Kick off mutation first so onMutate applies optimistic cache sync, then
      // exit edit mode immediately (do not wait on the network).
      if (singleExpectationMode && drafts.length === 1) {
        const draft = drafts[0]!;
        void upsertValue.mutateAsync({
          classId,
          expectationId: draft.expectationId,
          studentUserId,
          numberValue: draft.numberValue,
          rangeMin: draft.rangeMin,
          rangeMax: draft.rangeMax,
        });
      } else {
        void upsertStudentValues.mutateAsync({
          classId,
          studentUserId,
          values: drafts,
        });
      }
      cancelEdit();
    },

    [
      cancelEdit,
      classId,
      draftByExpectationId,
      expectations,
      singleExpectationMode,
      t,
      upsertStudentValues,
      upsertValue,
    ],
  );

  const editContextValue = useMemo(
    () => ({
      editingUserId,
      draftByExpectationId,
      setDraft,
      startEdit,
      cancelEdit,
      saveEdit,
    }),
    [cancelEdit, draftByExpectationId, editingUserId, saveEdit, setDraft, startEdit],
  );

  const extraColumns = useMemo((): ColumnDef<StudentRosterEntry, unknown>[] => {
    return expectations.map((expectation) => ({
      id: `expectation:${expectation._id}`,
      accessorFn: (student) => {
        const value = valueMap.get(`${expectation._id}:${student.userId}`);
        return expectationSortValue(expectation, value);
      },
      header: ({ column }) => (
        <div className="flex items-center justify-between gap-1">
          <DataTableSortableHeader
            label={expectation.name}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("columnActions")}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setBulkExpectation(expectation)}>
                {t("bulkSetAction")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      cell: ({ row }) => (
        <ExpectationInlineValueCell
          expectation={expectation}
          studentUserId={row.original.userId}
          value={valueMap.get(`${expectation._id}:${row.original.userId}`)}
        />
      ),
      sortingFn: (rowA, rowB) => {
        const a = expectationSortValue(
          expectation,
          valueMap.get(`${expectation._id}:${rowA.original.userId}`),
        );
        const b = expectationSortValue(
          expectation,
          valueMap.get(`${expectation._id}:${rowB.original.userId}`),
        );
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return a - b;
      },
      enableSorting: true,
    }));
  }, [expectations, t, valueMap]);

  const renderRowActions = useCallback(
    ({ student }: { student: StudentRosterEntry }) => <ExpectationRowActions student={student} />,
    [],
  );

  return (
    <ExpectationRowEditProvider value={editContextValue}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex justify-end">
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

        <ExpectationBulkSetCredenza
          open={bulkExpectation != null}
          onOpenChange={(open) => {
            if (!open) setBulkExpectation(null);
          }}
          expectation={bulkExpectation}
          studentCount={classStudentCount}
          onSubmit={async (args) => {
            if (!bulkExpectation) return;
            await bulkApply.mutateAsync({
              classId,
              expectationId: bulkExpectation._id,
              ...args,
            });
            setBulkExpectation(null);
          }}
        />
      </div>
    </ExpectationRowEditProvider>
  );
}
