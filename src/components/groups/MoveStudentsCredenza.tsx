import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AlsoCreateInGroupOption } from "@/lib/groups/groupFormSchema";
import {
  filterStudentsForMoveIntoGroup,
  type BoardStudent,
  type GroupsBoard,
  type MoveStudentsFilter,
} from "@/lib/groups/groups";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { getInitials } from "@/lib/user/userDisplay";
import type { Id } from "../../../convex/_generated/dataModel";

type FilterKind = MoveStudentsFilter["kind"];

type MoveStudentsCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: Id<"groups">;
  groupName: string;
  board: GroupsBoard;
  groupOptions: Array<AlsoCreateInGroupOption>;
  nameFormat?: RosterNameFormat;
  onConfirm: (studentUserIds: Array<Id<"users">>) => Promise<void>;
};

export function MoveStudentsCredenza({
  open,
  onOpenChange,
  groupId,
  groupName,
  board,
  groupOptions,
  nameFormat = DEFAULT_ROSTER_NAME_FORMAT,
  onConfirm,
}: MoveStudentsCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [filterKind, setFilterKind] = useState<FilterKind>("ungrouped");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Array<Id<"groups">>>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Array<Id<"users">>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chipsAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFilterKind("ungrouped");
    setSelectedGroupIds([]);
    setSelectedStudentIds([]);
    setIsSubmitting(false);
  }, [open]);

  const filter = useMemo<MoveStudentsFilter>(() => {
    if (filterKind === "ungrouped") return { kind: "ungrouped" };
    if (filterKind === "inGroups") return { kind: "inGroups", groupIds: selectedGroupIds };
    return { kind: "notInGroups", groupIds: selectedGroupIds };
  }, [filterKind, selectedGroupIds]);

  const candidates = useMemo(
    () => filterStudentsForMoveIntoGroup(board, groupId, filter, nameFormat),
    [board, filter, groupId, nameFormat],
  );

  useEffect(() => {
    const allowed = new Set(candidates.map((student) => student.userId));
    setSelectedStudentIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [candidates]);

  const selectedGroupsValue = useMemo(
    () => groupOptions.filter((option) => selectedGroupIds.includes(option.value)),
    [groupOptions, selectedGroupIds],
  );

  const needsGroupPicker = filterKind === "inGroups" || filterKind === "notInGroups";
  const allSelected =
    candidates.length > 0 &&
    candidates.every((student) => selectedStudentIds.includes(student.userId));
  const canSubmit = selectedStudentIds.length > 0 && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(selectedStudentIds);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  const toggleStudent = (studentUserId: Id<"users">, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) {
        if (prev.includes(studentUserId)) return prev;
        return [...prev, studentUserId];
      }
      return prev.filter((id) => id !== studentUserId);
    });
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-lg">
        <CredenzaHeader>
          <CredenzaTitle>{t("groupsMoveStudentsTitle", { name: groupName })}</CredenzaTitle>
          <CredenzaDescription>{t("groupsMoveStudentsDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-5">
          <Field>
            <FieldLabel>{t("groupsMoveStudentsFilterLabel")}</FieldLabel>
            <RadioGroup
              value={filterKind}
              onValueChange={(value) => {
                if (value === "ungrouped" || value === "inGroups" || value === "notInGroups") {
                  setFilterKind(value);
                  setSelectedStudentIds([]);
                }
              }}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
                <RadioGroupItem value="ungrouped" />
                <span className="text-sm">{t("groupsMoveStudentsFilterUngrouped")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
                <RadioGroupItem value="inGroups" />
                <span className="text-sm">{t("groupsMoveStudentsFilterInGroups")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
                <RadioGroupItem value="notInGroups" />
                <span className="text-sm">{t("groupsMoveStudentsFilterNotInGroups")}</span>
              </label>
            </RadioGroup>
          </Field>

          {needsGroupPicker ? (
            <Field>
              <FieldLabel>{t("groupsMoveStudentsGroupsLabel")}</FieldLabel>
              <FieldDescription>{t("groupsMoveStudentsGroupsHint")}</FieldDescription>
              <Combobox
                multiple
                items={groupOptions}
                value={selectedGroupsValue}
                isItemEqualToValue={(a, b) => a.value === b.value}
                onValueChange={(next) => {
                  setSelectedGroupIds((next ?? []).map((item) => item.value));
                  setSelectedStudentIds([]);
                }}
              >
                <ComboboxChips ref={chipsAnchorRef} className="w-full">
                  <ComboboxValue>
                    {(values: AlsoCreateInGroupOption[]) =>
                      values.map((item) => (
                        <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
                      ))
                    }
                  </ComboboxValue>
                  <ComboboxChipsInput
                    placeholder={
                      selectedGroupsValue.length === 0
                        ? t("groupsMoveStudentsGroupsPlaceholder")
                        : undefined
                    }
                    aria-label={t("groupsMoveStudentsGroupsLabel")}
                  />
                </ComboboxChips>
                <ComboboxContent anchor={chipsAnchorRef}>
                  <ComboboxEmpty>{t("groupsMoveStudentsGroupsEmpty")}</ComboboxEmpty>
                  <ComboboxList>
                    {(item: AlsoCreateInGroupOption) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          ) : null}

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>{t("groupsMoveStudentsListLabel")}</FieldLabel>
              {candidates.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    if (allSelected) {
                      setSelectedStudentIds([]);
                      return;
                    }
                    setSelectedStudentIds(candidates.map((student) => student.userId));
                  }}
                >
                  {allSelected
                    ? t("groupsMoveStudentsClearSelection")
                    : t("groupsMoveStudentsSelectAll")}
                </Button>
              ) : null}
            </div>
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {t("groupsMoveStudentsEmpty")}
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {candidates.map((student) => (
                  <StudentPickRow
                    key={student.userId}
                    student={student}
                    nameFormat={nameFormat}
                    checked={selectedStudentIds.includes(student.userId)}
                    onCheckedChange={(checked) => toggleStudent(student.userId, checked)}
                  />
                ))}
              </ul>
            )}
          </Field>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {tCommon("goBack")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t("groupsMoveStudentsConfirm", { count: selectedStudentIds.length })}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

function StudentPickRow({
  student,
  nameFormat,
  checked,
  onCheckedChange,
}: {
  student: BoardStudent;
  nameFormat: RosterNameFormat;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation("classes");
  const displayName = getRosterDisplayName(student, t("unnamedMember"), nameFormat);
  const id = `move-student-${student.userId}`;

  return (
    <li>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <Avatar className="size-6">
          {student.image ? (
            <AvatarImage src={student.image} alt={displayName} referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback className="text-[10px]">
            {getInitials({
              _id: student.userId,
              name: displayName,
              email: student.email,
            })}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-sm font-medium">{displayName}</span>
      </label>
    </li>
  );
}
