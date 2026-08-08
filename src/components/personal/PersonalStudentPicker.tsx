import { useTranslation } from "react-i18next";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getRosterDisplayName, type RosterNameFormat } from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

export type PersonalPickerStudent = {
  userId: Id<"users">;
  firstName?: string;
  lastName?: string;
  name?: string;
};

type PersonalStudentPickerProps = {
  students: ReadonlyArray<PersonalPickerStudent>;
  selectedUserId: Id<"users">;
  nameFormat: RosterNameFormat;
  onSelect: (userId: Id<"users">) => void;
};

/** Chip row for multi-student guardians; hidden when fewer than 2 students. */
export function PersonalStudentPicker({
  students,
  selectedUserId,
  nameFormat,
  onSelect,
}: PersonalStudentPickerProps) {
  const { t: tClasses } = useTranslation("classes");

  if (students.length < 2) return null;

  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[selectedUserId]}
      onValueChange={(values) => {
        const next = values[0] as Id<"users"> | undefined;
        if (next) onSelect(next);
      }}
      className="flex max-w-full flex-wrap"
    >
      {students.map((student) => {
        const label = getRosterDisplayName(student, tClasses("unnamedMember"), nameFormat);
        return (
          <ToggleGroupItem key={student.userId} value={student.userId} className="px-3">
            <span className="max-w-40 truncate">{label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
