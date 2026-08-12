import { APP_CONFIG } from "@/config/app";
import type { RosterNameFormat } from "@/lib/roster/roster";
import { formatRosterNameParts } from "@/lib/roster/roster";

export const RANDOM_ASSIGNER_PRINT_LOGO_PATH = "/brand/logo/icon-and-text-horizontal.webp";

/** Shared shape for random/equitable assigner print (IDs and flags differ by assigner type). */
export type AssignerPrintRunInput = {
  itemsSnapshot: string[];
  assignments: Array<{
    studentUserId: string;
    studentDisplayName: string;
    item: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
    groupId?: string;
    groupName?: string;
  }>;
};

export type RandomAssignerPrintLabels = {
  documentTitle: string;
  heading: string;
  subtitle: string;
  itemColumn: string;
  classColumn: string;
  ungroupedColumn: string;
  logoAlt: string;
};

export type RandomAssignerPrintMatrix = {
  groupNames: string[];
  rows: Array<{
    item: string;
    /** Student labels per group column (`#n - NAME`). */
    cells: Array<Array<string>>;
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

export function randomAssignerPrintLogoAlt(): string {
  return `${APP_CONFIG.name} Logo`;
}

export function formatRandomAssignerPrintStudent(
  assignment: {
    studentDisplayName: string;
    rosterNumber?: number;
    firstName?: string;
    lastName?: string;
  },
  nameFormat: RosterNameFormat,
): string {
  const name =
    formatRosterNameParts(assignment.firstName, assignment.lastName, nameFormat) ??
    assignment.studentDisplayName.trim();
  if (assignment.rosterNumber === undefined) return name;
  return `#${assignment.rosterNumber} - ${name}`;
}

function comparePrintStudents(
  a: { studentDisplayName: string; rosterNumber?: number },
  b: { studentDisplayName: string; rosterNumber?: number },
): number {
  const aNumber = a.rosterNumber ?? Number.POSITIVE_INFINITY;
  const bNumber = b.rosterNumber ?? Number.POSITIVE_INFINITY;
  if (aNumber !== bNumber) return aNumber - bNumber;
  return a.studentDisplayName.localeCompare(b.studentDisplayName);
}

/**
 * Rows = items (snapshot order). Columns = group names (or a single class column).
 * Cells list `#rosterNumber - name` for students who received that item in that group.
 */
export function buildRandomAssignerPrintMatrix(
  run: AssignerPrintRunInput,
  options: {
    classColumn: string;
    ungroupedColumn: string;
    nameFormat: RosterNameFormat;
  },
): RandomAssignerPrintMatrix {
  const namedGroups = new Map<string, string>();
  let hasUngrouped = false;

  for (const assignment of run.assignments) {
    if (assignment.groupId && assignment.groupName) {
      namedGroups.set(assignment.groupId, assignment.groupName);
    } else {
      hasUngrouped = true;
    }
  }

  const namedGroupEntries = [...namedGroups.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const useClassColumn = namedGroupEntries.length === 0;
  const groupNames = useClassColumn
    ? [options.classColumn]
    : [
        ...namedGroupEntries.map(([, name]) => name),
        ...(hasUngrouped ? [options.ungroupedColumn] : []),
      ];

  const columnIndexByKey = new Map<string, number>();
  if (useClassColumn) {
    columnIndexByKey.set("class", 0);
  } else {
    namedGroupEntries.forEach(([groupId], index) => {
      columnIndexByKey.set(groupId, index);
    });
    if (hasUngrouped) {
      columnIndexByKey.set("ungrouped", namedGroupEntries.length);
    }
  }

  const itemOrder =
    run.itemsSnapshot.length > 0
      ? run.itemsSnapshot
      : [...new Set(run.assignments.map((row) => row.item))];

  const rows = itemOrder.map((item) => {
    const buckets: Array<
      Array<{ studentDisplayName: string; rosterNumber?: number; label: string }>
    > = groupNames.map(() => []);

    for (const assignment of run.assignments) {
      if (assignment.item !== item) continue;
      const key = useClassColumn
        ? "class"
        : assignment.groupId && assignment.groupName
          ? assignment.groupId
          : "ungrouped";
      const columnIndex = columnIndexByKey.get(key);
      if (columnIndex === undefined) continue;
      buckets[columnIndex]?.push({
        studentDisplayName: assignment.studentDisplayName,
        rosterNumber: assignment.rosterNumber,
        label: formatRandomAssignerPrintStudent(assignment, options.nameFormat),
      });
    }

    return {
      item,
      cells: buckets.map((bucket) =>
        [...bucket].sort(comparePrintStudents).map((student) => student.label),
      ),
    };
  });

  return { groupNames, rows };
}

export function buildRandomAssignerPrintHtml(
  run: AssignerPrintRunInput,
  labels: RandomAssignerPrintLabels,
  logoUrl: string,
  nameFormat: RosterNameFormat,
): string {
  const matrix = buildRandomAssignerPrintMatrix(run, {
    classColumn: labels.classColumn,
    ungroupedColumn: labels.ungroupedColumn,
    nameFormat,
  });

  const headerCells = [
    `<th>${escapeHtml(labels.itemColumn)}</th>`,
    ...matrix.groupNames.map((name) => `<th>${escapeHtml(name)}</th>`),
  ].join("");

  const bodyRows = matrix.rows
    .map((row) => {
      const cells = row.cells
        .map(
          (students) => `<td>${students.map((student) => escapeHtml(student)).join("<br />")}</td>`,
        )
        .join("");
      return `<tr><td>${escapeHtml(row.item)}</td>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
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
    .brand { margin-bottom: 1rem; }
    .brand img { height: 40px; width: auto; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .meta { color: #555; font-size: 0.875rem; margin: 0 0 1.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
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
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export async function printRandomAssignerRun(
  run: AssignerPrintRunInput,
  labels: RandomAssignerPrintLabels,
  nameFormat: RosterNameFormat,
): Promise<void> {
  const logoUrl = new URL(RANDOM_ASSIGNER_PRINT_LOGO_PATH, window.location.origin).href;
  const html = buildRandomAssignerPrintHtml(run, labels, logoUrl, nameFormat);
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;",
  );
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Print frame unavailable");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await waitForImages(frameDocument);

  const cleanup = () => {
    iframe.remove();
  };
  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);
  frameWindow.focus();
  frameWindow.print();
}
