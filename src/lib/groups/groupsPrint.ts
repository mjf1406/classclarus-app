import type { GroupsBoard } from "@/lib/groups/groups";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { APP_CONFIG } from "@/config/app";
import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  resolveAppAssetUrl,
} from "@/lib/print/printDocument";
import { printHtmlDocument } from "@/lib/print/printFrame";

export const GROUPS_PRINT_LOGO_PATH = "/brand/logo/icon-and-text-horizontal.webp";

export type GroupsPrintMatrix = {
  groupNames: Array<string>;
  /** Team rows aligned by case-insensitive name; empty teams omitted. */
  rows: Array<{
    teamName: string;
    /** Student display names per group column (newline-separated in the print view). */
    cells: Array<Array<string>>;
  }>;
};

export type GroupsPrintLabels = {
  documentTitle: string;
  heading: string;
  subtitle: string;
  teamColumnLabel: string;
  logoAlt: string;
};

function studentLabel(
  student: GroupsBoard["ungrouped"][number],
  nameFormat: RosterNameFormat,
): string {
  // Empty fallback preserves getDisplayName's email / id suffix behavior for print.
  return getRosterDisplayName(student, "", nameFormat);
}

export type BuildGroupsPrintMatrixOptions = {
  /** Localized label for students in a group with no team. */
  teamlessLabel: string;
  nameFormat?: RosterNameFormat;
};

/**
 * Build a groups×teams matrix for print/PDF.
 * Columns = groups (board order). Rows = teamless (if any) then team names,
 * omitting named teams with zero students across all groups.
 */
export function buildGroupsPrintMatrix(
  board: GroupsBoard,
  options: BuildGroupsPrintMatrixOptions,
): GroupsPrintMatrix {
  const nameFormat = options.nameFormat ?? DEFAULT_ROSTER_NAME_FORMAT;
  const groups = board.groups;
  const groupNames = groups.map((group) => group.name);

  type Accumulator = {
    displayName: string;
    cells: Array<Array<string>>;
    studentCount: number;
  };

  const byKey = new Map<string, Accumulator>();
  const teamlessCells: Array<Array<string>> = groups.map(() => []);
  let teamlessCount = 0;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    if (!group) continue;

    const teamlessNames = group.students.map((student) => studentLabel(student, nameFormat));
    teamlessCells[groupIndex] = teamlessNames;
    teamlessCount += teamlessNames.length;

    for (const team of group.teams) {
      const key = team.name.toLocaleLowerCase();
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          displayName: team.name,
          cells: groups.map(() => []),
          studentCount: 0,
        };
        byKey.set(key, entry);
      }
      const names = team.students.map((student) => studentLabel(student, nameFormat));
      entry.cells[groupIndex] = names;
      entry.studentCount += names.length;
    }
  }

  const teamRows = [...byKey.values()]
    .filter((entry) => entry.studentCount > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((entry) => ({
      teamName: entry.displayName,
      cells: entry.cells,
    }));

  const rows =
    teamlessCount > 0
      ? [{ teamName: options.teamlessLabel, cells: teamlessCells }, ...teamRows]
      : teamRows;

  return { groupNames, rows };
}

export function buildGroupsPrintHtml(
  matrix: GroupsPrintMatrix,
  labels: GroupsPrintLabels,
  logoUrl: string,
): string {
  const headerCells = [
    `<th scope="col">${escapePrintHtml(labels.teamColumnLabel)}</th>`,
    ...matrix.groupNames.map((name) => `<th scope="col">${escapePrintHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells
        .map((names) => {
          const content =
            names.length === 0 ? "" : names.map((name) => escapePrintHtml(name)).join("<br />");
          return `<td>${content}</td>`;
        })
        .join("");
      return `<tr><th scope="row">${escapePrintHtml(row.teamName)}</th>${cells}</tr>`;
    })
    .join("");

  return `${buildPrintDocumentOpen({
    title: labels.documentTitle,
    bodyClass: "print-groups",
    lang: "en",
  })}
  <div class="brand">
    <img src="${escapePrintHtml(logoUrl)}" alt="${escapePrintHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapePrintHtml(labels.heading)}</h1>
  <p class="meta">${escapePrintHtml(labels.subtitle)}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>${buildPrintDocumentClose()}`;
}

/**
 * Open the system print dialog (user can choose Save as PDF) for the groups matrix.
 */
export async function printGroupsMatrix(
  matrix: GroupsPrintMatrix,
  labels: GroupsPrintLabels,
): Promise<void> {
  if (matrix.rows.length === 0 || matrix.groupNames.length === 0) {
    throw new Error("Nothing to print");
  }

  const logoUrl = resolveAppAssetUrl(GROUPS_PRINT_LOGO_PATH);
  const html = buildGroupsPrintHtml(matrix, labels, logoUrl);
  await printHtmlDocument({ documentTitle: labels.documentTitle, html });
}

export function groupsPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
