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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ExpandedState,
  type SortingFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
} from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type CSSProperties,
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
const EMPTY_SORTING: SortingState = [];
const EMPTY_EXPANDED: ExpandedState = {};

function MaybeSortableContext({
  enabled,
  items,
  strategy,
  children,
}: {
  enabled: boolean;
  items: string[];
  strategy: typeof horizontalListSortingStrategy | typeof verticalListSortingStrategy;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <SortableContext items={items} strategy={strategy}>
      {children}
    </SortableContext>
  );
}

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

const RosterNameFiltersContext = createContext<RosterNameColumnFilters | undefined>(undefined);

/**
 * Reads filter config from context so column defs stay referentially stable while
 * the controlled search value updates — otherwise TanStack Table remounts the
 * header input on every keystroke and focus is lost.
 */
function RosterNameColumnHeader({
  columnId,
  label,
  column,
  tableEditMode,
}: {
  columnId: "firstName" | "lastName" | "name";
  label: string;
  column: Column<StudentRosterEntry, unknown>;
  tableEditMode: boolean;
}) {
  const filters = useContext(RosterNameFiltersContext);
  const filter = filters?.[columnId];
  const title = tableEditMode ? (
    <span className="text-sm font-medium">{label}</span>
  ) : (
    rosterSortableHeader(label, column)
  );
  if (!filter) return title;
  return (
    <div className="flex min-w-36 flex-col gap-1 py-1">
      {title}
      <Input
        value={filter.value}
        onChange={(event) => filter.onChange(event.target.value)}
        placeholder={filter.placeholder}
        aria-label={filter["aria-label"]}
        autoComplete="off"
        spellCheck={false}
        className="h-8 rounded-lg"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </div>
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

export type RosterNameColumnFilter = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
};

export type RosterNameColumnFilters = Partial<
  Record<"firstName" | "lastName" | "name", RosterNameColumnFilter>
>;

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
  /**
   * When set, each row becomes expandable. Renders a full-width sub-row
   * under the student (e.g. assessment history on the RAZ page).
   */
  renderExpandedRow?: (student: StudentRosterEntry) => ReactNode;
  /** Accessible label for the expand/collapse control. */
  expandRowLabel?: (student: StudentRosterEntry, expanded: boolean) => string;
  /**
   * Override row identity (default: `userId`). Use when the same student can
   * appear more than once (e.g. one roster row per seat constraint).
   */
  getRowId?: (row: StudentRosterEntry) => string;
  /** Optional search inputs under first / last / name column headers. */
  nameColumnFilters?: RosterNameColumnFilters;
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
            <SelectValue placeholder={dash}>
              {draft.gender ? t(genderLabelKey(draft.gender)) : null}
            </SelectValue>
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
            <SelectValue placeholder={dash}>
              {draft.pronouns ? t(pronounLabelKey(draft.pronouns)) : null}
            </SelectValue>
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
  if (!tableEditMode) {
    return <TableHead>{children}</TableHead>;
  }
  return (
    <SortableHeaderCellActive id={id} greyed={greyed}>
      {children}
    </SortableHeaderCellActive>
  );
}

function SortableHeaderCellActive({
  id,
  greyed,
  children,
}: {
  id: string;
  greyed: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  });

  return (
    <TableHead
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : greyed ? 0.55 : 1,
      }}
      className="cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </TableHead>
  );
}

const ROW_TOGGLE_IGNORE_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"]';

type BodyRowDragHandle = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  showHandle: boolean;
};

const INACTIVE_DRAG_HANDLE: BodyRowDragHandle = {
  attributes: {
    role: "button",
    tabIndex: -1,
    "aria-disabled": true,
    "aria-pressed": undefined,
    "aria-roledescription": "sortable",
    "aria-describedby": "",
  },
  listeners: undefined,
  showHandle: false,
};

function RosterBodyRow({
  rowRef,
  style,
  isDragging,
  expandable,
  expanded,
  expandLabel,
  onToggleExpand,
  dragHandle,
  children,
}: {
  rowRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  expandLabel?: string;
  onToggleExpand?: () => void;
  dragHandle: BodyRowDragHandle;
  children: (dragHandle: BodyRowDragHandle) => ReactNode;
}) {
  return (
    <TableRow
      ref={rowRef}
      style={style}
      data-dragging={isDragging || undefined}
      data-state={expandable && expanded ? "selected" : undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-label={expandable ? expandLabel : undefined}
      tabIndex={expandable ? 0 : undefined}
      className={expandable ? "cursor-pointer" : undefined}
      onClick={
        expandable && onToggleExpand
          ? (event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              if (target.closest(ROW_TOGGLE_IGNORE_SELECTOR)) return;
              onToggleExpand();
            }
          : undefined
      }
      onKeyDown={
        expandable && onToggleExpand
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              const target = event.target;
              if (!(target instanceof Element)) return;
              // Only handle when the row itself (not a nested control) has focus.
              if (target !== event.currentTarget) return;
              event.preventDefault();
              onToggleExpand();
            }
          : undefined
      }
    >
      {children(dragHandle)}
    </TableRow>
  );
}

function SortableBodyRow({
  id,
  tableEditMode,
  rowEditActive,
  expandable,
  expanded,
  expandLabel,
  onToggleExpand,
  children,
}: {
  id: string;
  tableEditMode: boolean;
  rowEditActive: boolean;
  expandable?: boolean;
  expanded?: boolean;
  expandLabel?: string;
  onToggleExpand?: () => void;
  children: (dragHandle: BodyRowDragHandle) => ReactNode;
}) {
  const shared = {
    expandable,
    expanded,
    expandLabel,
    onToggleExpand,
    children,
  };

  if (!tableEditMode) {
    return <RosterBodyRow dragHandle={INACTIVE_DRAG_HANDLE} {...shared} />;
  }

  return <SortableBodyRowActive id={id} rowEditActive={rowEditActive} {...shared} />;
}

function SortableBodyRowActive({
  id,
  rowEditActive,
  expandable,
  expanded,
  expandLabel,
  onToggleExpand,
  children,
}: {
  id: string;
  rowEditActive: boolean;
  expandable?: boolean;
  expanded?: boolean;
  expandLabel?: string;
  onToggleExpand?: () => void;
  children: (dragHandle: BodyRowDragHandle) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id,
    disabled: rowEditActive,
    animateLayoutChanges: () => false,
  });

  return (
    <RosterBodyRow
      rowRef={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.7 : 1,
      }}
      isDragging={isDragging}
      expandable={expandable}
      expanded={expanded}
      expandLabel={expandLabel}
      onToggleExpand={onToggleExpand}
      dragHandle={{ attributes, listeners, showHandle: !rowEditActive }}
    >
      {children}
    </RosterBodyRow>
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
  renderExpandedRow,
  expandRowLabel,
  getRowId,
  nameColumnFilters,
}: RosterTableProps) {
  const { t } = useTranslation("classes");
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowOrderOverride, setRowOrderOverride] = useState<StudentRosterEntry[] | null>(null);

  const tableRows = rowOrderOverride ?? data;
  const dataOrderKey = useMemo(() => data.map((entry) => entry.userId).join("\0"), [data]);

  useEffect(() => {
    setRowOrderOverride(null);
  }, [dataOrderKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dash = t("rosterUnset");
  const rowEditLocksDnD = editingUserId !== null;
  const showActions = renderRowActions != null;
  const showExpand = renderExpandedRow != null && !tableEditMode;
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

  useEffect(() => {
    if (!editingUserId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      saveEdit(editingUserId);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editingUserId, saveEdit]);

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
    if (showExpand) {
      state.expand = true;
    }
    if (showActions) {
      state.actions = true;
    }
    return state;
  }, [columnVisibility, tableEditMode, extraColumnIds, showExpand, showActions]);

  const effectiveOrder = useMemo((): ColumnOrderState => {
    const order: ColumnOrderState = [
      ...(showExpand ? (["expand"] as const) : []),
      ...columnOrder,
      ...extraColumnIds,
    ];
    if (showActions) order.push("actions");
    return order;
  }, [columnOrder, extraColumnIds, showExpand, showActions]);

  const columns = useMemo((): ColumnDef<StudentRosterEntry>[] => {
    const headerLabel = (label: string, column: Column<StudentRosterEntry, unknown>) =>
      tableEditMode ? label : rosterSortableHeader(label, column);

    const nameHeader = (
      columnId: "firstName" | "lastName" | "name",
      label: string,
      column: Column<StudentRosterEntry, unknown>,
    ) => (
      <RosterNameColumnHeader
        columnId={columnId}
        label={label}
        column={column}
        tableEditMode={tableEditMode}
      />
    );

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

    const expandColumn: ColumnDef<StudentRosterEntry> | null = showExpand
      ? {
          id: "expand",
          header: () => <span className="sr-only">{t("rosterColumnExpand")}</span>,
          enableHiding: false,
          enableSorting: false,
          cell: ({ row }) => {
            const expanded = row.getIsExpanded();
            const label =
              expandRowLabel?.(row.original, expanded) ??
              (expanded ? t("rosterCollapseRow") : t("rosterExpandRow"));
            return (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-expanded={expanded}
                aria-label={label}
                onClick={() => row.toggleExpanded()}
              >
                {expanded ? (
                  <ChevronDownIcon className="size-4" aria-hidden />
                ) : (
                  <ChevronRightIcon className="size-4" aria-hidden />
                )}
              </Button>
            );
          },
        }
      : null;

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
        header: ({ column }) => nameHeader("lastName", t("rosterColumnLastName"), column),
        cell: ({ row }) => <LastNameCell student={row.original} />,
        sortingFn: textSortingFn((student) => student.lastName),
        enableSorting: true,
      },
      {
        id: "firstName",
        accessorKey: "firstName",
        header: ({ column }) => nameHeader("firstName", t("rosterColumnFirstName"), column),
        cell: ({ row }) => <FirstNameCell student={row.original} />,
        sortingFn: textSortingFn((student) => student.firstName),
        enableSorting: true,
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => nameHeader("name", t("rosterColumnName"), column),
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

    const withExtras = [...(expandColumn ? [expandColumn] : []), ...base, ...extras];

    if (!showActions || !renderRowActions) {
      return withExtras;
    }

    return [
      ...withExtras,
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
  }, [t, extraColumns, showActions, showExpand, renderRowActions, expandRowLabel, tableEditMode]);

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      columnOrder: effectiveOrder,
      columnVisibility: effectiveVisibility,
      sorting: tableEditMode ? EMPTY_SORTING : sorting,
      expanded: showExpand ? expanded : EMPTY_EXPANDED,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => showExpand,
    getRowId: (row) => (getRowId ? getRowId(row) : row.userId),
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
    const userIds = tableRows.map((entry) => entry.userId);
    const oldIndex = userIds.indexOf(activeId as Id<"users">);
    const newIndex = userIds.indexOf(overId as Id<"users">);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(userIds, oldIndex, newIndex);
    const byId = new Map(tableRows.map((row) => [row.userId, row] as const));
    setRowOrderOverride(
      nextIds.flatMap((userId, index) => {
        const entry = byId.get(userId);
        return entry ? [{ ...entry, rosterNumber: index + 1 }] : [];
      }),
    );
    onReorderRows(nextIds);
  };

  const headerIds = useMemo(
    () => columnOrder.filter((id) => tableEditMode || columnVisibility[id]),
    [columnOrder, tableEditMode, columnVisibility],
  );
  const rowIds = useMemo(() => tableRows.map((entry) => entry.userId), [tableRows]);

  const tableNode = (
    <div className="min-w-0 overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              <MaybeSortableContext
                enabled={tableEditMode}
                items={headerIds}
                strategy={horizontalListSortingStrategy}
              >
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
              </MaybeSortableContext>
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          <MaybeSortableContext
            enabled={tableEditMode}
            items={rowIds}
            strategy={verticalListSortingStrategy}
          >
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <SortableBodyRow
                    id={row.id}
                    tableEditMode={tableEditMode}
                    rowEditActive={rowEditLocksDnD}
                    expandable={showExpand}
                    expanded={row.getIsExpanded()}
                    expandLabel={
                      showExpand
                        ? (expandRowLabel?.(row.original, row.getIsExpanded()) ??
                          (row.getIsExpanded() ? t("rosterCollapseRow") : t("rosterExpandRow")))
                        : undefined
                    }
                    onToggleExpand={showExpand ? () => row.toggleExpanded() : undefined}
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
                  {showExpand && row.getIsExpanded() && renderExpandedRow ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={Math.max(row.getVisibleCells().length, 1)}
                        className="bg-muted/30 p-3"
                      >
                        {renderExpandedRow(row.original)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
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
          </MaybeSortableContext>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <RosterEditContext.Provider value={editContextValue}>
      <RosterNameFiltersContext.Provider value={nameColumnFilters}>
        {tableEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {tableNode}
          </DndContext>
        ) : (
          tableNode
        )}
      </RosterNameFiltersContext.Provider>
    </RosterEditContext.Provider>
  );
}
