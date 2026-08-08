"use no memo";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type SortingFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { EyeIcon, EyeOffIcon, GripVerticalIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";

import { DataTableSortableHeader } from "@/components/feedback/DataTableSortableHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  ROSTER_COLUMN_IDS,
  genderLabelKey,
  pronounLabelKey,
  type GenderOption,
  type PronounOption,
  type RosterColumnId,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { getDisplayName } from "@/lib/user/userDisplay";
import type { Id } from "../../../convex/_generated/dataModel";

export type RosterSaveRowDraft = {
  firstName: string | null;
  lastName: string | null;
  gender: GenderOption | null;
  genderSelfDescribe: string | null;
  pronouns: PronounOption | null;
  pronounsSelfDescribe: string | null;
};

const DEFAULT_SORTING: SortingState = [{ id: "rosterNumber", desc: false }];

function compareOptionalText(a: string | undefined | null, b: string | undefined | null): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function textSortingFn(
  read: (row: StudentRosterEntry) => string | undefined | null,
): SortingFn<StudentRosterEntry> {
  return (rowA, rowB) => compareOptionalText(read(rowA.original), read(rowB.original));
}

function rosterSortableHeader(label: string, column: Column<StudentRosterEntry, unknown>) {
  return (
    <DataTableSortableHeader
      label={label}
      sorted={column.getIsSorted()}
      onSort={() => column.toggleSorting(column.getIsSorted() === "asc")}
    />
  );
}

type RowDraft = {
  firstName: string;
  lastName: string;
  gender: GenderOption | "";
  genderSelfDescribe: string;
  pronouns: PronounOption | "";
  pronounsSelfDescribe: string;
};

type RosterEditContextValue = {
  editingUserId: Id<"users"> | null;
  draft: RowDraft | null;
  setDraft: Dispatch<SetStateAction<RowDraft | null>>;
  canUpdateRoster: boolean;
  dash: string;
  startEdit: (student: StudentRosterEntry) => void;
  cancelEdit: () => void;
  saveEdit: (userId: Id<"users">) => void;
};

const RosterEditContext = createContext<RosterEditContextValue | null>(null);

function useRosterEdit() {
  const value = useContext(RosterEditContext);
  if (!value) {
    throw new Error("useRosterEdit must be used within RosterEditContext");
  }
  return value;
}

export type RosterRowActionsContext = {
  student: StudentRosterEntry;
  isEditing: boolean;
  editingLocked: boolean;
  canUpdateRoster: boolean;
  startEdit: () => void;
  saveEdit: () => void;
  cancelEdit: () => void;
};

export type RosterTableProps = {
  data: StudentRosterEntry[];
  columnOrder: RosterColumnId[];
  columnVisibility: Record<RosterColumnId, boolean>;
  onColumnVisibilityChange?: (visibility: Record<RosterColumnId, boolean>) => void;
  /** Students page only — enables column/row DnD and header visibility toggles. */
  tableEditMode?: boolean;
  canUpdateRoster?: boolean;
  onColumnOrderChange?: (order: RosterColumnId[]) => void;
  onReorderRows?: (userIds: Id<"users">[]) => void;
  onSaveRow?: (userId: Id<"users">, draft: RosterSaveRowDraft) => void;
  /** Appended after base roster columns (before actions). */
  extraColumns?: ColumnDef<StudentRosterEntry, unknown>[];
  renderRowActions?: (ctx: RosterRowActionsContext) => ReactNode;
};

function LastNameCell({ student }: { student: StudentRosterEntry }) {
  const { t } = useTranslation("classes");
  const { editingUserId, draft, setDraft, dash } = useRosterEdit();
  if (editingUserId === student.userId && draft) {
    return (
      <Input
        value={draft.lastName}
        onChange={(event) =>
          setDraft((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))
        }
        aria-label={t("rosterColumnLastName")}
        className="h-8"
      />
    );
  }
  return student.lastName?.trim() || dash;
}

function FirstNameCell({ student }: { student: StudentRosterEntry }) {
  const { t } = useTranslation("classes");
  const { editingUserId, draft, setDraft, dash } = useRosterEdit();
  if (editingUserId === student.userId && draft) {
    return (
      <Input
        value={draft.firstName}
        onChange={(event) =>
          setDraft((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))
        }
        aria-label={t("rosterColumnFirstName")}
        className="h-8"
      />
    );
  }
  return student.firstName?.trim() || dash;
}

function GenderCell({ student }: { student: StudentRosterEntry }) {
  const { t } = useTranslation("classes");
  const { editingUserId, draft, setDraft, dash } = useRosterEdit();
  if (editingUserId === student.userId && draft) {
    return (
      <div className="flex min-w-40 flex-col gap-1">
        <Select
          value={draft.gender || undefined}
          onValueChange={(value) => {
            if (value == null) return;
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    gender: value as GenderOption,
                    genderSelfDescribe: value === "selfDescribe" ? prev.genderSelfDescribe : "",
                  }
                : prev,
            );
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={t("rosterColumnGender")}>
            <SelectValue placeholder={dash} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {GENDER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(genderLabelKey(option))}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {draft.gender === "selfDescribe" ? (
          <Input
            value={draft.genderSelfDescribe}
            onChange={(event) =>
              setDraft((prev) =>
                prev ? { ...prev, genderSelfDescribe: event.target.value } : prev,
              )
            }
            placeholder={t("rosterSelfDescribePlaceholder")}
            className="h-8"
          />
        ) : null}
      </div>
    );
  }
  if (!student.gender) return dash;
  if (student.gender === "selfDescribe" && student.genderSelfDescribe) {
    return student.genderSelfDescribe;
  }
  return t(genderLabelKey(student.gender));
}

function PronounsCell({ student }: { student: StudentRosterEntry }) {
  const { t } = useTranslation("classes");
  const { editingUserId, draft, setDraft, dash } = useRosterEdit();
  if (editingUserId === student.userId && draft) {
    return (
      <div className="flex min-w-40 flex-col gap-1">
        <Select
          value={draft.pronouns || undefined}
          onValueChange={(value) => {
            if (value == null) return;
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    pronouns: value as PronounOption,
                    pronounsSelfDescribe:
                      value === "askSelfDescribe" ? prev.pronounsSelfDescribe : "",
                  }
                : prev,
            );
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={t("rosterColumnPronouns")}>
            <SelectValue placeholder={dash} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRONOUN_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(pronounLabelKey(option))}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {draft.pronouns === "askSelfDescribe" ? (
          <Input
            value={draft.pronounsSelfDescribe}
            onChange={(event) =>
              setDraft((prev) =>
                prev ? { ...prev, pronounsSelfDescribe: event.target.value } : prev,
              )
            }
            placeholder={t("rosterSelfDescribePlaceholder")}
            className="h-8"
          />
        ) : null}
      </div>
    );
  }
  if (!student.pronouns) return dash;
  if (student.pronouns === "askSelfDescribe" && student.pronounsSelfDescribe) {
    return student.pronounsSelfDescribe;
  }
  return t(pronounLabelKey(student.pronouns));
}

function SortableHeaderCell({
  id,
  tableEditMode,
  greyed,
  children,
}: {
  id: string;
  tableEditMode: boolean;
  greyed: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !tableEditMode,
  });

  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : greyed ? 0.55 : 1,
      }}
      className={tableEditMode ? "cursor-grab active:cursor-grabbing" : undefined}
      {...(tableEditMode ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </TableHead>
  );
}

function SortableBodyRow({
  id,
  tableEditMode,
  rowEditActive,
  children,
}: {
  id: string;
  tableEditMode: boolean;
  rowEditActive: boolean;
  children: (dragHandle: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    showHandle: boolean;
  }) => ReactNode;
}) {
  const disabled = !tableEditMode || rowEditActive;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      data-dragging={isDragging || undefined}
    >
      {children({ attributes, listeners, showHandle: !disabled })}
    </TableRow>
  );
}

function ActionsCell({
  student,
  renderRowActions,
}: {
  student: StudentRosterEntry;
  renderRowActions: (ctx: RosterRowActionsContext) => ReactNode;
}) {
  const { editingUserId, canUpdateRoster, startEdit, cancelEdit, saveEdit } = useRosterEdit();

  return (
    <>
      {renderRowActions({
        student,
        isEditing: editingUserId === student.userId,
        editingLocked: editingUserId !== null && editingUserId !== student.userId,
        canUpdateRoster,
        startEdit: () => startEdit(student),
        saveEdit: () => saveEdit(student.userId),
        cancelEdit,
      })}
    </>
  );
}

export function RosterTable({
  data,
  columnOrder,
  columnVisibility,
  onColumnVisibilityChange,
  tableEditMode = false,
  canUpdateRoster = false,
  onColumnOrderChange,
  onReorderRows,
  onSaveRow,
  extraColumns,
  renderRowActions,
}: RosterTableProps) {
  const { t } = useTranslation("classes");
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const dash = t("rosterUnset");
  const rowEditLocksDnD = editingUserId !== null;
  const showActions = renderRowActions != null;
  const extraColumnIds = useMemo(
    () => (extraColumns ?? []).map((column, index) => column.id ?? `extra-${index}`),
    [extraColumns],
  );

  const startEdit = useCallback(
    (student: StudentRosterEntry) => {
      if (!canUpdateRoster || !onSaveRow) return;
      setEditingUserId(student.userId);
      setDraft({
        firstName: student.firstName ?? "",
        lastName: student.lastName ?? "",
        gender: student.gender ?? "",
        genderSelfDescribe: student.genderSelfDescribe ?? "",
        pronouns: student.pronouns ?? "",
        pronounsSelfDescribe: student.pronounsSelfDescribe ?? "",
      });
    },
    [canUpdateRoster, onSaveRow],
  );

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setDraft(null);
  }, []);

  const saveEdit = useCallback(
    (userId: Id<"users">) => {
      if (!draft || !onSaveRow) return;
      const payload: RosterSaveRowDraft = {
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        gender: draft.gender || null,
        genderSelfDescribe:
          draft.gender === "selfDescribe" ? draft.genderSelfDescribe.trim() || null : null,
        pronouns: draft.pronouns || null,
        pronounsSelfDescribe:
          draft.pronouns === "askSelfDescribe" ? draft.pronounsSelfDescribe.trim() || null : null,
      };
      setEditingUserId(null);
      setDraft(null);
      onSaveRow(userId, payload);
    },
    [draft, onSaveRow],
  );

  const editContextValue = useMemo(
    (): RosterEditContextValue => ({
      editingUserId,
      draft,
      setDraft,
      canUpdateRoster: canUpdateRoster && onSaveRow != null,
      dash,
      startEdit,
      cancelEdit,
      saveEdit,
    }),
    [editingUserId, draft, canUpdateRoster, onSaveRow, dash, startEdit, cancelEdit, saveEdit],
  );

  const effectiveVisibility = useMemo((): VisibilityState => {
    const state: VisibilityState = {};
    for (const id of ROSTER_COLUMN_IDS) {
      state[id] = tableEditMode ? true : columnVisibility[id];
    }
    for (const id of extraColumnIds) {
      state[id] = true;
    }
    if (showActions) {
      state.actions = true;
    }
    return state;
  }, [columnVisibility, tableEditMode, extraColumnIds, showActions]);

  const effectiveOrder = useMemo((): ColumnOrderState => {
    const order: ColumnOrderState = [...columnOrder, ...extraColumnIds];
    if (showActions) order.push("actions");
    return order;
  }, [columnOrder, extraColumnIds, showActions]);

  const columns = useMemo((): ColumnDef<StudentRosterEntry>[] => {
    const headerLabel = (label: string, column: Column<StudentRosterEntry, unknown>) =>
      tableEditMode ? label : rosterSortableHeader(label, column);

    const genderSortValue = (student: StudentRosterEntry): string => {
      if (!student.gender) return "";
      if (student.gender === "selfDescribe") {
        return student.genderSelfDescribe?.trim() || t(genderLabelKey(student.gender));
      }
      return t(genderLabelKey(student.gender));
    };

    const pronounsSortValue = (student: StudentRosterEntry): string => {
      if (!student.pronouns) return "";
      if (student.pronouns === "askSelfDescribe") {
        return student.pronounsSelfDescribe?.trim() || t(pronounLabelKey(student.pronouns));
      }
      return t(pronounLabelKey(student.pronouns));
    };

    const base: ColumnDef<StudentRosterEntry>[] = [
      {
        id: "rosterNumber",
        accessorKey: "rosterNumber",
        header: ({ column }) => headerLabel(t("rosterColumnRosterNumber"), column),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 tabular-nums">
            <span>{row.original.rosterNumber}</span>
          </div>
        ),
        enableHiding: true,
        enableSorting: true,
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: ({ column }) => headerLabel(t("rosterColumnLastName"), column),
        cell: ({ row }) => <LastNameCell student={row.original} />,
        sortingFn: textSortingFn((student) => student.lastName),
        enableSorting: true,
      },
      {
        id: "firstName",
        accessorKey: "firstName",
        header: ({ column }) => headerLabel(t("rosterColumnFirstName"), column),
        cell: ({ row }) => <FirstNameCell student={row.original} />,
        sortingFn: textSortingFn((student) => student.firstName),
        enableSorting: true,
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => headerLabel(t("rosterColumnName"), column),
        cell: ({ row }) =>
          getDisplayName(
            {
              _id: row.original.userId,
              name: row.original.name,
              email: row.original.email,
            },
            t("unnamedMember"),
          ),
        sortingFn: textSortingFn((student) =>
          getDisplayName(
            {
              _id: student.userId,
              name: student.name,
              email: student.email,
            },
            t("unnamedMember"),
          ),
        ),
        enableSorting: true,
      },
      {
        id: "email",
        accessorKey: "email",
        header: ({ column }) => headerLabel(t("rosterColumnEmail"), column),
        cell: ({ row }) => row.original.email?.trim() || t("rosterUnset"),
        sortingFn: textSortingFn((student) => student.email),
        enableSorting: true,
      },
      {
        id: "gender",
        accessorKey: "gender",
        header: ({ column }) => headerLabel(t("rosterColumnGender"), column),
        cell: ({ row }) => <GenderCell student={row.original} />,
        sortingFn: textSortingFn(genderSortValue),
        enableSorting: true,
      },
      {
        id: "pronouns",
        accessorKey: "pronouns",
        header: ({ column }) => headerLabel(t("rosterColumnPronouns"), column),
        cell: ({ row }) => <PronounsCell student={row.original} />,
        sortingFn: textSortingFn(pronounsSortValue),
        enableSorting: true,
      },
    ];

    const extras = (extraColumns ?? []).map((column): ColumnDef<StudentRosterEntry, unknown> => {
      const enableSorting = column.enableSorting ?? true;
      if (!enableSorting || tableEditMode || typeof column.header !== "string") {
        return { ...column, enableSorting } as ColumnDef<StudentRosterEntry, unknown>;
      }
      const label = column.header;
      return {
        ...column,
        enableSorting,
        header: ({ column: tableColumn }) => rosterSortableHeader(label, tableColumn),
      } as ColumnDef<StudentRosterEntry, unknown>;
    });

    if (!showActions || !renderRowActions) {
      return [...base, ...extras];
    }

    return [
      ...base,
      ...extras,
      {
        id: "actions",
        header: t("rosterColumnActions"),
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <ActionsCell student={row.original} renderRowActions={renderRowActions} />
        ),
      },
    ];
  }, [t, extraColumns, showActions, renderRowActions, tableEditMode]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder: effectiveOrder,
      columnVisibility: effectiveVisibility,
      sorting: tableEditMode ? [] : sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.userId,
    enableSorting: !tableEditMode,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    if (!tableEditMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (columnOrder.includes(activeId as RosterColumnId)) {
      if (!onColumnOrderChange) return;
      const oldIndex = columnOrder.indexOf(activeId as RosterColumnId);
      const newIndex = columnOrder.indexOf(overId as RosterColumnId);
      if (oldIndex < 0 || newIndex < 0) return;
      onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
      return;
    }

    if (!onReorderRows) return;
    const userIds = data.map((entry) => entry.userId);
    const oldIndex = userIds.indexOf(activeId as Id<"users">);
    const newIndex = userIds.indexOf(overId as Id<"users">);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderRows(arrayMove(userIds, oldIndex, newIndex));
  };

  const headerIds = columnOrder.filter((id) => tableEditMode || columnVisibility[id]);
  const rowIds = data.map((entry) => entry.userId);

  const tableNode = (
    <div className="min-w-0 overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              <SortableContext items={headerIds} strategy={horizontalListSortingStrategy}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const isDataColumn = ROSTER_COLUMN_IDS.includes(columnId as RosterColumnId);
                  const greyed =
                    tableEditMode && isDataColumn && !columnVisibility[columnId as RosterColumnId];

                  if (!isDataColumn) {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  }

                  return (
                    <SortableHeaderCell
                      key={header.id}
                      id={columnId}
                      tableEditMode={tableEditMode && !rowEditLocksDnD}
                      greyed={greyed}
                    >
                      <div className="flex items-center gap-1.5">
                        {tableEditMode ? (
                          <GripVerticalIcon
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        ) : null}
                        <span>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {tableEditMode && onColumnVisibilityChange ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            className="shrink-0"
                            aria-label={
                              columnVisibility[columnId as RosterColumnId]
                                ? t("rosterHideColumn")
                                : t("rosterShowColumn")
                            }
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              const id = columnId as RosterColumnId;
                              onColumnVisibilityChange({
                                ...columnVisibility,
                                [id]: !columnVisibility[id],
                              });
                            }}
                          >
                            {columnVisibility[columnId as RosterColumnId] ? (
                              <EyeIcon />
                            ) : (
                              <EyeOffIcon />
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </SortableHeaderCell>
                  );
                })}
              </SortableContext>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <SortableBodyRow
                  key={row.id}
                  id={row.id}
                  tableEditMode={tableEditMode}
                  rowEditActive={rowEditLocksDnD}
                >
                  {({ attributes, listeners, showHandle }) =>
                    row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.column.id === "rosterNumber" ? (
                          <div className="flex items-center gap-2 tabular-nums">
                            {showHandle ? (
                              <button
                                type="button"
                                className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                                aria-label={t("rosterDragRow")}
                                {...attributes}
                                {...listeners}
                              >
                                <GripVerticalIcon className="size-4" aria-hidden />
                              </button>
                            ) : null}
                            <span>{row.original.rosterNumber}</span>
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </TableCell>
                    ))
                  }
                </SortableBodyRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={Math.max(effectiveOrder.length, 1)}
                  className="h-24 text-center"
                >
                  {t("membersSearchNoResults")}
                </TableCell>
              </TableRow>
            )}
          </SortableContext>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <RosterEditContext.Provider value={editContextValue}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {tableNode}
      </DndContext>
    </RosterEditContext.Provider>
  );
}
