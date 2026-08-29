import { APP_CONFIG } from "@/config/app";
import { slotKey, type SeatChartAssignment } from "@/lib/assigners/seatCharts";
import { resolveTeamLabel, type SeatLayoutItem } from "@/lib/assigners/seatLayouts";
import { SEATS_PRINT_LOGO_PATH } from "@/lib/assigners/seatsPrint";
import type { GroupsBoard } from "@/lib/groups/groups";
import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  resolveAppAssetUrl,
} from "@/lib/print/printDocument";
import { printHtmlDocument } from "@/lib/print/printFrame";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";

export type SeatChartPrintTableLabels = {
  documentTitle: string;
  heading: string;
  subtitle: string;
  seatColumn: string;
  logoAlt: string;
};

export type SeatChartPrintTableMatrix = {
  groupNames: string[];
  rows: Array<{
    seatLabel: string;
    cells: string[];
  }>;
};

export function formatSeatChartTableStudentCell(
  student: Pick<
    StudentRosterEntry,
    "userId" | "firstName" | "lastName" | "name" | "email" | "rosterNumber"
  >,
  nameFormat: RosterNameFormat,
  unnamedLabel: string,
): string {
  const name = getRosterDisplayName(student, unnamedLabel, nameFormat);
  return `#${student.rosterNumber} - ${name}`;
}

export function formatSeatChartTableSeatLabel(
  desk: Pick<SeatLayoutItem, "deskNumber" | "teamAssignment">,
  board: GroupsBoard,
): string {
  const deskNumber = desk.deskNumber;
  if (deskNumber === undefined) return "";

  const team = resolveTeamLabel(desk.teamAssignment, board.groups);
  const teamLabel = team?.label?.trim();
  if (teamLabel) {
    return `(${teamLabel}) ${deskNumber}`;
  }
  return String(deskNumber);
}

export function buildSeatChartPrintTableMatrix(args: {
  layoutItems: ReadonlyArray<SeatLayoutItem>;
  assignments: ReadonlyArray<SeatChartAssignment>;
  roster: ReadonlyArray<StudentRosterEntry>;
  board: GroupsBoard;
  nameFormat: RosterNameFormat;
  unnamedLabel: string;
}): SeatChartPrintTableMatrix {
  const rosterById = new Map(args.roster.map((student) => [student.userId, student]));
  const assignmentBySlot = new Map(
    args.assignments.map((assignment) => [
      slotKey(assignment.deskItemId, assignment.groupId),
      assignment,
    ]),
  );
  const groupIds = args.board.groups.map((group) => group._id);
  const groupNames = args.board.groups.map((group) => group.name);

  const desks = args.layoutItems
    .filter((item): item is SeatLayoutItem & { deskNumber: number } => {
      return item.kind === "desk" && item.deskNumber !== undefined;
    })
    .sort((left, right) => left.deskNumber - right.deskNumber);

  const rows = desks.map((desk) => {
    const seatLabel = formatSeatChartTableSeatLabel(desk, args.board);
    const cells = groupIds.map((groupId) => {
      const assignment = assignmentBySlot.get(slotKey(desk.id, groupId));
      if (!assignment) return "";
      const student = rosterById.get(assignment.studentUserId);
      if (!student) return "";
      return formatSeatChartTableStudentCell(student, args.nameFormat, args.unnamedLabel);
    });
    return { seatLabel, cells };
  });

  return { groupNames, rows };
}

export function buildSeatChartPrintTableHtml(
  matrix: SeatChartPrintTableMatrix,
  labels: SeatChartPrintTableLabels,
  logoUrl: string,
): string {
  const headerCells = [
    `<th>${escapePrintHtml(labels.seatColumn)}</th>`,
    ...matrix.groupNames.map((name) => `<th>${escapePrintHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => `<td>${cell ? escapePrintHtml(cell) : ""}</td>`)
        .join("");
      return `<tr><td>${escapePrintHtml(row.seatLabel)}</td>${cells}</tr>`;
    })
    .join("");

  return `${buildPrintDocumentOpen({
    title: labels.documentTitle,
    bodyClass: "print-table-compact",
  })}
  <div class="brand">
    <img src="${escapePrintHtml(logoUrl)}" alt="${escapePrintHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapePrintHtml(labels.heading)}</h1>
  <p class="meta">${escapePrintHtml(labels.subtitle)}</p>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>${buildPrintDocumentClose()}`;
}

export async function printSeatChartTable(
  matrix: SeatChartPrintTableMatrix,
  labels: SeatChartPrintTableLabels,
): Promise<void> {
  const logoUrl = resolveAppAssetUrl(SEATS_PRINT_LOGO_PATH);
  const html = buildSeatChartPrintTableHtml(matrix, labels, logoUrl);
  await printHtmlDocument({ documentTitle: labels.documentTitle, html });
}

export function seatChartTablePrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
