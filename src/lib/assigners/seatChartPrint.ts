import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";
import {
  printSeatLayout,
  type SeatsPrintItem,
  type SeatsPrintLabels,
} from "@/lib/assigners/seatsPrint";
import {
  resolveTeamLabel,
  seatItemDisplayLabel,
  type SeatLayoutItem,
} from "@/lib/assigners/seatLayouts";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { GroupsBoard } from "@/lib/groups/groups";
import type { SeatLayoutPrintSelection } from "@/components/assigners/SeatLayoutPrintCredenza";

function rosterNameInitial(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0)}.`;
}

function formatCompactRosterNameParts(
  firstName: string | undefined,
  lastName: string | undefined,
  format: RosterNameFormat,
): string | undefined {
  const first = firstName?.trim() || undefined;
  const last = lastName?.trim() || undefined;
  if (!first && !last) return undefined;

  const sep = format.space ? " " : "";

  if (first && last) {
    if (format.order === "lastFirst") {
      return `${last}${sep}${rosterNameInitial(first)}`;
    }
    return `${first}${sep}${rosterNameInitial(last)}`;
  }
  if (first) return first;
  if (last) {
    return format.order === "lastFirst" ? last : rosterNameInitial(last);
  }
  return undefined;
}

export function formatSeatChartPrintStudentLabel(
  student: Pick<
    StudentRosterEntry,
    "userId" | "firstName" | "lastName" | "name" | "email" | "rosterNumber"
  >,
  unnamedFallback: string,
  nameFormat: RosterNameFormat,
): string {
  const rosterSuffix = `#${student.rosterNumber}`;
  const compactName = formatCompactRosterNameParts(student.firstName, student.lastName, nameFormat);

  if (compactName) {
    return `${compactName} ${rosterSuffix}`;
  }

  const fallback = getRosterDisplayName(student, unnamedFallback, nameFormat);
  return fallback ? `${fallback} ${rosterSuffix}` : rosterSuffix;
}

export function buildSeatChartPrintItems(args: {
  layoutItems: ReadonlyArray<SeatLayoutItem>;
  assignments: ReadonlyArray<SeatChartAssignment>;
  roster: ReadonlyArray<StudentRosterEntry>;
  board: GroupsBoard;
  nameFormat: RosterNameFormat;
  unnamedLabel: string;
  staleTeamLabel?: string;
}): Array<SeatsPrintItem> {
  const rosterById = new Map(args.roster.map((student) => [student.userId, student]));
  const assignmentsByDesk = new Map<string, Array<SeatChartAssignment>>();
  for (const assignment of args.assignments) {
    const list = assignmentsByDesk.get(assignment.deskItemId) ?? [];
    list.push(assignment);
    assignmentsByDesk.set(assignment.deskItemId, list);
  }

  return args.layoutItems.map((item) => {
    const deskAssignments = assignmentsByDesk.get(item.id) ?? [];
    const labels = deskAssignments.map((assignment) => {
      const student = rosterById.get(assignment.studentUserId);
      const group = args.board.groups.find((g) => g._id === assignment.groupId);
      const displayName = student
        ? formatSeatChartPrintStudentLabel(student, args.unnamedLabel, args.nameFormat)
        : args.unnamedLabel;
      const groupLabel = group?.name?.trim();
      return groupLabel ? `${displayName} (${groupLabel})` : displayName;
    });

    const team = resolveTeamLabel(item.teamAssignment, args.board.groups);
    const zoneName = item.zoneName?.trim();

    return {
      ...item,
      label: seatItemDisplayLabel(item, { teacherDesk: "Teacher", board: "Board", rect: "Area" }),
      ...(team && !team.stale
        ? { teamLabel: team.label }
        : team?.stale
          ? { teamLabel: args.staleTeamLabel }
          : {}),
      ...(zoneName ? { zoneLabel: zoneName } : {}),
      ...(labels.length > 0 ? { studentLabel: labels.join(" · ") } : {}),
    };
  });
}

export async function printSeatChart(args: {
  selection: SeatLayoutPrintSelection;
  canvasWidth: number;
  canvasHeight: number;
  items: Array<SeatsPrintItem>;
  labels: SeatsPrintLabels;
}): Promise<void> {
  await printSeatLayout(
    {
      canvasWidth: args.canvasWidth,
      canvasHeight: args.canvasHeight,
      orientations: args.selection.orientations,
      perPage: args.selection.perPage,
      items: args.items,
    },
    args.labels,
  );
}
