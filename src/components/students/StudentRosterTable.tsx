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
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PencilIcon,
  UserMinusIcon,
  XIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";

import { ClassRoleSelectLabel } from "@/components/badges/ClassRoleBadges";
import { Can } from "@/components/permissions/Can";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
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
  assignableRolesFor,
  canChangeMemberRole,
  removePermissionForMember,
  type JoinCodeRole,
} from "@/lib/members/members";
import { isJoinCodeRole } from "@/lib/permissions/classPermissions";
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

type RowDraft = {
  firstName: string;
  lastName: string;
  gender: GenderOption | "";
  genderSelfDescribe: string;
  pronouns: PronounOption | "";
  pronounsSelfDescribe: string;
};

type SaveRowDraft = {
  firstName: string | null;
  lastName: string | null;
  gender: GenderOption | null;
  genderSelfDescribe: string | null;
  pronouns: PronounOption | null;
  pronounsSelfDescribe: string | null;
};

type RosterEditContextValue = {
  editingUserId: Id<"users"> | null;
  draft: RowDraft | null;
  setDraft: Dispatch<SetStateAction<RowDraft | null>>;
  canUpdateRoster: boolean;
  currentUserId?: Id<"users">;
  dash: string;
  startEdit: (student: StudentRosterEntry) => void;
  cancelEdit: () => void;
  saveEdit: (userId: Id<"users">) => void;
  onRemove: (student: StudentRosterEntry) => void;
  onChangeRole: (student: StudentRosterEntry, role: JoinCodeRole) => void;
};

const RosterEditContext = createContext<RosterEditContextValue | null>(null);

function useRosterEdit() {
  const value = useContext(RosterEditContext);
  if (!value) {
    throw new Error("useRosterEdit must be used within RosterEditContext");
  }
  return value;
}

type StudentRosterTableProps = {
  data: StudentRosterEntry[];
  tableEditMode: boolean;
  canUpdateRoster: boolean;
  columnOrder: RosterColumnId[];
  columnVisibility: Record<RosterColumnId, boolean>;
  onColumnOrderChange: (order: RosterColumnId[]) => void;
  onColumnVisibilityChange: (visibility: Record<RosterColumnId, boolean>) => void;
  onReorderRows: (userIds: Id<"users">[]) => void;
  onSaveRow: (userId: Id<"users">, draft: SaveRowDraft) => void;
  onRemove: (student: StudentRosterEntry) => void;
  onChangeRole: (student: StudentRosterEntry, role: JoinCodeRole) => void;
  currentUserId?: Id<"users">;
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

function ActionsCell({ student }: { student: StudentRosterEntry }) {
  const { t } = useTranslation("classes");
  const { role: actorRole } = useClassPermissionsContext();
  const {
    editingUserId,
    canUpdateRoster,
    currentUserId,
    startEdit,
    cancelEdit,
    saveEdit,
    onRemove,
    onChangeRole,
  } = useRosterEdit();

  const isSelf = currentUserId === student.userId;
  const isEditing = editingUserId === student.userId;
  const removePermission = removePermissionForMember("student");
  const showRemove = !isSelf && removePermission !== null;
  const showRoleSelect = !isSelf && canChangeMemberRole(actorRole, "student");
  const roleOptions = actorRole ? assignableRolesFor(actorRole) : [];

  if (isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" onClick={() => saveEdit(student.userId)}>
          <CheckIcon data-icon="inline-start" />
          {t("rosterSaveRow")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
          <XIcon data-icon="inline-start" />
          {t("rosterCancelRow")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {canUpdateRoster ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={editingUserId !== null}
          onClick={() => startEdit(student)}
        >
          <PencilIcon data-icon="inline-start" />
          {t("rosterEditRow")}
        </Button>
      ) : null}
      {showRoleSelect ? (
        <Select
          value="student"
          onValueChange={(next) => {
            if (next == null || !isJoinCodeRole(next) || next === "student") return;
            onChangeRole(student, next);
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={t("changeRole")}>
            <SelectValue>
              <ClassRoleSelectLabel role="student" colored />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  <ClassRoleSelectLabel role={role} />
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}
      {showRemove && removePermission ? (
        <Can permission={removePermission}>
          <Button type="button" size="sm" variant="outline" onClick={() => onRemove(student)}>
            <UserMinusIcon data-icon="inline-start" />
            {t("removeMember")}
          </Button>
        </Can>
      ) : null}
    </div>
  );
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
  children: React.ReactNode;
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
  }) => React.ReactNode;
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

export function StudentRosterTable({
  data,
  tableEditMode,
  canUpdateRoster,
  columnOrder,
  columnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  onReorderRows,
  onSaveRow,
  onRemove,
  onChangeRole,
  currentUserId,
}: StudentRosterTableProps) {
  const { t } = useTranslation("classes");
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const dash = t("rosterUnset");
  const rowEditLocksDnD = editingUserId !== null;

  const startEdit = useCallback((student: StudentRosterEntry) => {
    setEditingUserId(student.userId);
    setDraft({
      firstName: student.firstName ?? "",
      lastName: student.lastName ?? "",
      gender: student.gender ?? "",
      genderSelfDescribe: student.genderSelfDescribe ?? "",
      pronouns: student.pronouns ?? "",
      pronounsSelfDescribe: student.pronounsSelfDescribe ?? "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setDraft(null);
  }, []);

  const saveEdit = useCallback(
    (userId: Id<"users">) => {
      if (!draft) return;
      const payload: SaveRowDraft = {
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        gender: draft.gender || null,
        genderSelfDescribe:
          draft.gender === "selfDescribe" ? draft.genderSelfDescribe.trim() || null : null,
        pronouns: draft.pronouns || null,
        pronounsSelfDescribe:
          draft.pronouns === "askSelfDescribe" ? draft.pronounsSelfDescribe.trim() || null : null,
      };
      // Exit edit mode immediately; cache updates optimistically in the mutation hook.
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
      canUpdateRoster,
      currentUserId,
      dash,
      startEdit,
      cancelEdit,
      saveEdit,
      onRemove,
      onChangeRole,
    }),
    [
      editingUserId,
      draft,
      canUpdateRoster,
      currentUserId,
      dash,
      startEdit,
      cancelEdit,
      saveEdit,
      onRemove,
      onChangeRole,
    ],
  );

  const effectiveVisibility = useMemo((): VisibilityState => {
    const state: VisibilityState = { actions: true };
    for (const id of ROSTER_COLUMN_IDS) {
      state[id] = tableEditMode ? true : columnVisibility[id];
    }
    return state;
  }, [columnVisibility, tableEditMode]);

  const effectiveOrder = useMemo(
    (): ColumnOrderState => [...columnOrder, "actions"],
    [columnOrder],
  );

  // Keep column defs stable — editable cells read draft via context so typing
  // does not recreate columns (which remounts inputs and steals focus).
  const columns = useMemo((): ColumnDef<StudentRosterEntry>[] => {
    return [
      {
        id: "rosterNumber",
        accessorKey: "rosterNumber",
        header: t("rosterColumnRosterNumber"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 tabular-nums">
            <span>{row.original.rosterNumber}</span>
          </div>
        ),
        enableHiding: true,
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: t("rosterColumnLastName"),
        cell: ({ row }) => <LastNameCell student={row.original} />,
      },
      {
        id: "firstName",
        accessorKey: "firstName",
        header: t("rosterColumnFirstName"),
        cell: ({ row }) => <FirstNameCell student={row.original} />,
      },
      {
        id: "name",
        accessorKey: "name",
        header: t("rosterColumnName"),
        cell: ({ row }) =>
          getDisplayName(
            {
              _id: row.original.userId,
              name: row.original.name,
              email: row.original.email,
            },
            t("unnamedMember"),
          ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: t("rosterColumnEmail"),
        cell: ({ row }) => row.original.email?.trim() || t("rosterUnset"),
      },
      {
        id: "gender",
        accessorKey: "gender",
        header: t("rosterColumnGender"),
        cell: ({ row }) => <GenderCell student={row.original} />,
      },
      {
        id: "pronouns",
        accessorKey: "pronouns",
        header: t("rosterColumnPronouns"),
        cell: ({ row }) => <PronounsCell student={row.original} />,
      },
      {
        id: "actions",
        header: t("rosterColumnActions"),
        enableHiding: false,
        cell: ({ row }) => <ActionsCell student={row.original} />,
      },
    ];
  }, [t]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder: effectiveOrder,
      columnVisibility: effectiveVisibility,
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.userId,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (columnOrder.includes(activeId as RosterColumnId)) {
      const oldIndex = columnOrder.indexOf(activeId as RosterColumnId);
      const newIndex = columnOrder.indexOf(overId as RosterColumnId);
      if (oldIndex < 0 || newIndex < 0) return;
      onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
      return;
    }

    const userIds = data.map((entry) => entry.userId);
    const oldIndex = userIds.indexOf(activeId as Id<"users">);
    const newIndex = userIds.indexOf(overId as Id<"users">);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderRows(arrayMove(userIds, oldIndex, newIndex));
  };

  const headerIds = columnOrder.filter((id) => tableEditMode || columnVisibility[id]);
  const rowIds = data.map((entry) => entry.userId);

  return (
    <RosterEditContext.Provider value={editContextValue}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext items={headerIds} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => {
                      const columnId = header.column.id;
                      const isActions = columnId === "actions";
                      const isDataColumn = ROSTER_COLUMN_IDS.includes(columnId as RosterColumnId);
                      const greyed =
                        tableEditMode &&
                        isDataColumn &&
                        !columnVisibility[columnId as RosterColumnId];

                      if (isActions || !isDataColumn) {
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
                            {tableEditMode ? (
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
                    <TableCell colSpan={effectiveOrder.length} className="h-24 text-center">
                      {t("membersSearchNoResults")}
                    </TableCell>
                  </TableRow>
                )}
              </SortableContext>
            </TableBody>
          </Table>
        </div>
      </DndContext>
    </RosterEditContext.Provider>
  );
}
