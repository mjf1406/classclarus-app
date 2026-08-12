import { APP_CONFIG } from "@/config/app";
import { slotKey, type SeatChartAssignment } from "@/lib/assigners/seatCharts";
import { resolveTeamLabel, type SeatLayoutItem } from "@/lib/assigners/seatLayouts";
import { SEATS_PRINT_LOGO_PATH } from "@/lib/assigners/seatsPrint";
import type { GroupsBoard } from "@/lib/groups/groups";
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    `<th>${escapeHtml(labels.seatColumn)}</th>`,
    ...matrix.groupNames.map((name) => `<th>${escapeHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells.map((cell) => `<td>${cell ? escapeHtml(cell) : ""}</td>`).join("");
      return `<tr><td>${escapeHtml(row.seatLabel)}</td>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.documentTitle)}</title>
  <style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .brand { margin-bottom: 0.75rem; }
    .brand img { height: 36px; width: auto; }
    h1 { font-size: 1rem; margin: 0 0 0.25rem; }
    .meta { color: #555; font-size: 0.75rem; margin: 0 0 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
    th, td { border: 1px solid #ccc; padding: 0.3rem 0.4rem; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; }
    td:first-child, th:first-child { font-weight: 600; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="brand">
    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapeHtml(labels.heading)}</h1>
  <p class="meta">${escapeHtml(labels.subtitle)}</p>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function waitForImages(doc: Document): Promise<void> {
  const images = [...doc.images];
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export async function printSeatChartTable(
  matrix: SeatChartPrintTableMatrix,
  labels: SeatChartPrintTableLabels,
): Promise<void> {
  const logoUrl = new URL(SEATS_PRINT_LOGO_PATH, window.location.origin).href;
  const html = buildSeatChartPrintTableHtml(matrix, labels, logoUrl);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", labels.documentTitle);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Could not open print frame");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  try {
    await waitForImages(frameDocument);
    const cleanup = () => {
      iframe.remove();
    };
    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    iframe.remove();
    throw error;
  }
}

export function seatChartTablePrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
