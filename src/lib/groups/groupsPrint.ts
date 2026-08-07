import type { GroupsBoard } from "@/lib/groups/groups";
import {
  DEFAULT_ROSTER_NAME_FORMAT,
  getRosterDisplayName,
  type RosterNameFormat,
} from "@/lib/roster/roster";
import { APP_CONFIG } from "@/config/app";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    `<th scope="col">${escapeHtml(labels.teamColumnLabel)}</th>`,
    ...matrix.groupNames.map((name) => `<th scope="col">${escapeHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells
        .map((names) => {
          const content =
            names.length === 0 ? "" : names.map((name) => escapeHtml(name)).join("<br />");
          return `<td>${content}</td>`;
        })
        .join("");
      return `<tr><th scope="row">${escapeHtml(row.teamName)}</th>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.documentTitle)}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.4;
    }
    .brand {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    .brand img {
      display: block;
      height: 40px;
      width: auto;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .meta {
      margin: 0 0 16px;
      color: #555;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 8px 10px;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    thead th {
      background: #f4f4f5;
      font-weight: 650;
      text-align: left;
    }
    tbody th {
      background: #fafafa;
      font-weight: 600;
      text-align: left;
      width: 12rem;
    }
  </style>
</head>
<body>
  <div class="brand">
    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(labels.logoAlt)}" width="169" height="53" />
  </div>
  <h1>${escapeHtml(labels.heading)}</h1>
  <p class="meta">${escapeHtml(labels.subtitle)}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
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

  const logoUrl = new URL(GROUPS_PRINT_LOGO_PATH, window.location.origin).href;
  const html = buildGroupsPrintHtml(matrix, labels, logoUrl);

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
    // Fallback if afterprint never fires (some browsers).
    window.setTimeout(cleanup, 60_000);
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    iframe.remove();
    throw error;
  }
}

export function groupsPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}
